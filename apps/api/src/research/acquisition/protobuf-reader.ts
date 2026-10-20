/**
 * Minimal Protocol Buffers wire-format reader for the OSM PBF format.
 *
 * Only the wire types used by `fileformat.proto` and `osmformat.proto` are
 * supported. Integers are decoded into JavaScript numbers, which is exact for
 * every value OSM uses (ids, coordinates, offsets, and timestamps stay below
 * 2^53). Negative non-zigzag `int64` values are rejected rather than silently
 * truncated.
 */
export const WireType = {
  varint: 0,
  fixed64: 1,
  lengthDelimited: 2,
  fixed32: 5,
} as const;

export class ProtobufDecodeError extends Error {}

export class ProtobufReader {
  private position: number;

  constructor(
    private readonly buffer: Uint8Array,
    start = 0,
    private readonly end = buffer.length,
  ) {
    this.position = start;
  }

  get done(): boolean {
    return this.position >= this.end;
  }

  readTag(): { field: number; wireType: number } {
    const tag = this.readVarint();
    return { field: Math.floor(tag / 8), wireType: tag % 8 };
  }

  readVarint(): number {
    let result = 0;
    let multiplier = 1;
    for (let index = 0; index < 10; index += 1) {
      if (this.position >= this.end) throw new ProtobufDecodeError('Truncated varint');
      const byte = this.buffer[this.position++] ?? 0;
      result += (byte & 0x7f) * multiplier;
      if ((byte & 0x80) === 0) {
        if (!Number.isSafeInteger(result)) {
          throw new ProtobufDecodeError('Varint exceeds the safe integer range');
        }
        return result;
      }
      multiplier *= 128;
    }
    throw new ProtobufDecodeError('Malformed varint');
  }

  readSignedVarint(): number {
    return decodeZigZag(this.readVarint());
  }

  readBoolean(): boolean {
    return this.readVarint() !== 0;
  }

  readBytes(): Uint8Array {
    const length = this.readVarint();
    const start = this.position;
    const end = start + length;
    if (end > this.end) throw new ProtobufDecodeError('Length-delimited field overflows message');
    this.position = end;
    return this.buffer.subarray(start, end);
  }

  readString(): string {
    return textDecoder.decode(this.readBytes());
  }

  /** Returns a reader over a nested message without copying it. */
  readMessage(): ProtobufReader {
    const bytes = this.readBytes();
    return new ProtobufReader(bytes);
  }

  readPackedVarints(): number[] {
    const reader = this.readMessage();
    const values: number[] = [];
    while (!reader.done) values.push(reader.readVarint());
    return values;
  }

  readPackedSignedVarints(): number[] {
    const reader = this.readMessage();
    const values: number[] = [];
    while (!reader.done) values.push(reader.readSignedVarint());
    return values;
  }

  skip(wireType: number): void {
    switch (wireType) {
      case WireType.varint:
        this.readVarint();
        return;
      case WireType.fixed64:
        this.advance(8);
        return;
      case WireType.lengthDelimited:
        this.advance(this.readVarint());
        return;
      case WireType.fixed32:
        this.advance(4);
        return;
      default:
        throw new ProtobufDecodeError(`Unsupported wire type ${String(wireType)}`);
    }
  }

  private advance(bytes: number): void {
    if (this.position + bytes > this.end) throw new ProtobufDecodeError('Field overflows message');
    this.position += bytes;
  }
}

export function decodeZigZag(value: number): number {
  return value % 2 === 1 ? -(value + 1) / 2 : value / 2;
}

const textDecoder = new TextDecoder('utf-8', { fatal: true });
