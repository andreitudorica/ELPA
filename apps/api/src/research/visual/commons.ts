import { createHash } from 'node:crypto';

import { z } from 'zod';

import { MAX_IMAGE_BYTES } from './integrity';

const USER_AGENT = 'ELPA-Visual-Experiment/1.0 (https://github.com/andreitudorica/ELPA)';
const valueSchema = z.object({ value: z.string() });
const infoSchema = z.object({
  url: z.url(),
  descriptionurl: z.url(),
  sha1: z.string().regex(/^[a-f0-9]{40}$/),
  timestamp: z.iso.datetime(),
  size: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mime: z.string(),
  extmetadata: z.record(z.string(), valueSchema),
});
const responseSchema = z.object({
  query: z.object({
    pages: z.record(
      z.string(),
      z.object({
        title: z.string(),
        pageid: z.number().int().optional(),
        missing: z.unknown().optional(),
        imageinfo: z.array(infoSchema).optional(),
      }),
    ),
  }),
});
export type CommonsImageInfo = z.infer<typeof infoSchema>;

export function textFromMetadata(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/** A file licence is checked independently of the licence on OSM tags. */
export function commonsPermission(info: CommonsImageInfo) {
  const licence = info.extmetadata.LicenseShortName?.value;
  const licenceUrl = info.extmetadata.LicenseUrl?.value.replace(/\/$/, '');
  const credit = textFromMetadata(info.extmetadata.Artist?.value ?? '');
  if (
    licence !== 'CC BY-SA 4.0' ||
    licenceUrl !== 'https://creativecommons.org/licenses/by-sa/4.0' ||
    credit === ''
  )
    throw new Error('image.permission_not_established');
  if (info.size > MAX_IMAGE_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime))
    throw new Error('image.source_format_or_size');
  const url = new URL(info.url);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'upload.wikimedia.org' ||
    !url.pathname.startsWith('/wikipedia/commons/')
  )
    throw new Error('image.source_host');
  url.search = '';
  url.hash = '';
  const sourcePage = new URL(info.descriptionurl);
  if (sourcePage.protocol !== 'https:' || sourcePage.hostname !== 'commons.wikimedia.org')
    throw new Error('image.page_host');
  return {
    licence: 'CC BY-SA 4.0' as const,
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' as const,
    credit,
    imageUrl: url.toString(),
    sourcePage: sourcePage.toString(),
  };
}

async function boundedBody(response: Response, limit: number): Promise<Buffer> {
  if (!response.ok || response.body === null)
    throw new Error(`image.http_${String(response.status)}`);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (let result = await reader.read(); !result.done; result = await reader.read()) {
      const chunk = z.instanceof(Uint8Array).parse(result.value);
      size += chunk.length;
      if (size > limit) throw new Error('image.download_byte_limit');
      parts.push(chunk);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(parts);
}

export async function readCommonsMetadata(titles: string[]) {
  z.array(z.string().startsWith('File:')).min(1).max(3).parse(titles);
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [key, value] of Object.entries({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|sha1|timestamp|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription|DateTimeOriginal',
    titles: titles.join('|'),
  }))
    url.searchParams.set(key, value);
  const body = await boundedBody(
    await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    }),
    1024 * 1024,
  );
  const raw: unknown = JSON.parse(body.toString('utf8'));
  const parsed = responseSchema.parse(raw);
  return {
    raw,
    pages: Object.values(parsed.query.pages),
    retrievedAt: new Date().toISOString(),
    requestUrl: url.toString(),
  };
}

export async function downloadCommonsImage(info: CommonsImageInfo) {
  const permission = commonsPermission(info);
  const bytes = await boundedBody(
    await fetch(permission.imageUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    }),
    MAX_IMAGE_BYTES,
  );
  if (createHash('sha1').update(bytes).digest('hex') !== info.sha1 || bytes.length !== info.size)
    throw new Error('image.source_fingerprint_mismatch');
  return { bytes, permission, retrievedAt: new Date().toISOString() };
}
