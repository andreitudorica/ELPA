import sharp from 'sharp';

import { sha256Hex } from '../acquisition/source-record';

export const IMAGE_PROCESSING_VERSION = 'grp-image-integrity@1';
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;

export class ImageIntegrityError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Decode pixels before accepting an image; never render SVG or animated input. */
export async function inspectImage(bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES)
    throw new ImageIntegrityError('image.byte_limit');
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!jpeg && !png && !webp) throw new ImageIntegrityError('image.unsupported_type');
  try {
    const options = { failOn: 'warning' as const, limitInputPixels: MAX_PIXELS };
    const metadata = await sharp(bytes, options).metadata();
    if (metadata.pages !== undefined && metadata.pages !== 1)
      throw new ImageIntegrityError('image.multiple_frames');
    if (metadata.width < 32 || metadata.height < 32)
      throw new ImageIntegrityError('image.too_small');
    const decoded = await sharp(bytes, options)
      .autoOrient()
      .removeAlpha()
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });
    const oriented = sharp(decoded.data, {
      raw: {
        width: decoded.info.width,
        height: decoded.info.height,
        channels: decoded.info.channels,
      },
    });
    const gray = await oriented
      .clone()
      .resize(9, 8, { fit: 'fill', kernel: 'lanczos3' })
      .grayscale()
      .raw()
      .toBuffer();
    let bits = 0n;
    for (let y = 0; y < 8; y += 1)
      for (let x = 0; x < 8; x += 1) {
        bits <<= 1n;
        if ((gray[y * 9 + x] ?? 0) > (gray[y * 9 + x + 1] ?? 0)) bits |= 1n;
      }
    const preview = await oriented
      .clone()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return {
      sha256: sha256Hex(bytes),
      byteSize: bytes.length,
      width: decoded.info.width,
      height: decoded.info.height,
      format: png ? ('png' as const) : jpeg ? ('jpeg' as const) : ('webp' as const),
      dHash: bits.toString(16).padStart(16, '0'),
      previewSha256: sha256Hex(preview),
      preview,
      processingVersion: IMAGE_PROCESSING_VERSION,
    };
  } catch (error) {
    if (error instanceof ImageIntegrityError) throw error;
    throw new ImageIntegrityError('image.decode_failed');
  }
}

export function hammingDistance(left: string, right: string): number {
  if (!/^[a-f0-9]{16}$/.test(left) || !/^[a-f0-9]{16}$/.test(right))
    throw new ImageIntegrityError('image.invalid_dhash');
  let difference = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (difference !== 0n) {
    count += Number(difference & 1n);
    difference >>= 1n;
  }
  return count;
}
