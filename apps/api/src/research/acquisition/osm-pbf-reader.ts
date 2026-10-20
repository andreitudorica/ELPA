import { open } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

import { ProtobufReader, WireType } from './protobuf-reader';

/**
 * Streaming reader for OpenStreetMap PBF files (`fileformat.proto` framing
 * plus `osmformat.proto` blocks). Entities are delivered to callbacks in file
 * order, so callers can select objects without materialising the whole
 * extract. Only zlib-compressed and raw blobs are supported; any other
 * compression or an unsupported required feature fails format validation.
 */

export class OsmPbfFormatError extends Error {}

export const SUPPORTED_REQUIRED_FEATURES = ['OsmSchema-V0.6', 'DenseNodes'] as const;

export interface OsmPbfHeader {
  requiredFeatures: string[];
  optionalFeatures: string[];
  writingProgram: string | null;
  source: string | null;
  /** ISO-8601 replication timestamp: the data version of the extract. */
  replicationTimestamp: string | null;
  replicationSequenceNumber: number | null;
  replicationBaseUrl: string | null;
}

export interface OsmEntityMetadata {
  version: number | null;
  /** Epoch milliseconds of the object's last edit, when present. */
  timestamp: number | null;
}

export type OsmTags = Readonly<Record<string, string>>;

export interface OsmNode extends OsmEntityMetadata {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags: OsmTags;
}

export interface OsmWay extends OsmEntityMetadata {
  type: 'way';
  id: number;
  refs: number[];
  tags: OsmTags;
}

export interface OsmRelationMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
}

export interface OsmRelation extends OsmEntityMetadata {
  type: 'relation';
  id: number;
  members: OsmRelationMember[];
  tags: OsmTags;
}

export interface OsmPbfHandlers {
  header?: (header: OsmPbfHeader) => void;
  node?: (node: OsmNode) => void;
  way?: (way: OsmWay) => void;
  relation?: (relation: OsmRelation) => void;
}

const EMPTY_TAGS: OsmTags = Object.freeze({});
const MEMBER_TYPES = ['node', 'way', 'relation'] as const;
const MAX_BLOB_HEADER_SIZE = 64 * 1024;
const MAX_BLOB_SIZE = 32 * 1024 * 1024;

export async function readOsmPbf(path: string, handlers: OsmPbfHandlers): Promise<OsmPbfHeader> {
  const file = await open(path, 'r');
  let header: OsmPbfHeader | undefined;
  try {
    let offset = 0;
    const lengthBuffer = Buffer.alloc(4);
    for (;;) {
      const { bytesRead } = await file.read(lengthBuffer, 0, 4, offset);
      if (bytesRead === 0) break;
      if (bytesRead < 4) throw new OsmPbfFormatError('Truncated blob header length');
      offset += 4;

      const headerLength = lengthBuffer.readUInt32BE(0);
      if (headerLength > MAX_BLOB_HEADER_SIZE) {
        throw new OsmPbfFormatError(`Blob header too large: ${String(headerLength)} bytes`);
      }
      const blobHeader = decodeBlobHeader(await readExactly(file, offset, headerLength));
      offset += headerLength;

      if (blobHeader.dataSize > MAX_BLOB_SIZE) {
        throw new OsmPbfFormatError(`Blob too large: ${String(blobHeader.dataSize)} bytes`);
      }
      const blob = await readExactly(file, offset, blobHeader.dataSize);
      offset += blobHeader.dataSize;
      const block = decodeBlob(blob);

      if (blobHeader.type === 'OSMHeader') {
        if (header !== undefined) throw new OsmPbfFormatError('Duplicate OSMHeader block');
        header = decodeHeaderBlock(block);
        handlers.header?.(header);
      } else if (blobHeader.type === 'OSMData') {
        if (header === undefined) throw new OsmPbfFormatError('OSMData block before OSMHeader');
        decodePrimitiveBlock(block, handlers);
      }
      // Unknown blob types are skipped, as required by the format specification.
    }
  } finally {
    await file.close();
  }

  if (header === undefined) throw new OsmPbfFormatError('File contains no OSMHeader block');
  return header;
}

async function readExactly(
  file: Awaited<ReturnType<typeof open>>,
  position: number,
  length: number,
): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await file.read(buffer, 0, length, position);
  if (bytesRead !== length) throw new OsmPbfFormatError('Unexpected end of file');
  return buffer;
}

function decodeBlobHeader(bytes: Uint8Array): { type: string; dataSize: number } {
  const reader = new ProtobufReader(bytes);
  let type: string | undefined;
  let dataSize: number | undefined;
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1) type = reader.readString();
    else if (field === 3) dataSize = reader.readVarint();
    else reader.skip(wireType);
  }
  if (type === undefined || dataSize === undefined) {
    throw new OsmPbfFormatError('Blob header is missing type or datasize');
  }
  return { type, dataSize };
}

function decodeBlob(bytes: Uint8Array): Uint8Array {
  const reader = new ProtobufReader(bytes);
  let rawSize: number | undefined;
  let data: Uint8Array | undefined;
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1) {
      data = reader.readBytes();
    } else if (field === 2) {
      rawSize = reader.readVarint();
    } else if (field === 3) {
      data = inflateSync(reader.readBytes());
    } else if (field >= 4 && field <= 7) {
      throw new OsmPbfFormatError(`Unsupported blob compression (field ${String(field)})`);
    } else {
      reader.skip(wireType);
    }
  }
  if (data === undefined) throw new OsmPbfFormatError('Blob has no data');
  if (rawSize !== undefined && rawSize !== data.length) {
    throw new OsmPbfFormatError('Decompressed blob size does not match raw_size');
  }
  return data;
}

function decodeHeaderBlock(bytes: Uint8Array): OsmPbfHeader {
  const reader = new ProtobufReader(bytes);
  const header: OsmPbfHeader = {
    requiredFeatures: [],
    optionalFeatures: [],
    writingProgram: null,
    source: null,
    replicationTimestamp: null,
    replicationSequenceNumber: null,
    replicationBaseUrl: null,
  };
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    switch (field) {
      case 4:
        header.requiredFeatures.push(reader.readString());
        break;
      case 5:
        header.optionalFeatures.push(reader.readString());
        break;
      case 16:
        header.writingProgram = reader.readString();
        break;
      case 17:
        header.source = reader.readString();
        break;
      case 32:
        header.replicationTimestamp = new Date(reader.readVarint() * 1000).toISOString();
        break;
      case 33:
        header.replicationSequenceNumber = reader.readVarint();
        break;
      case 34:
        header.replicationBaseUrl = reader.readString();
        break;
      default:
        reader.skip(wireType);
    }
  }

  const unsupported = header.requiredFeatures.filter(
    (feature) => !(SUPPORTED_REQUIRED_FEATURES as readonly string[]).includes(feature),
  );
  if (unsupported.length > 0) {
    throw new OsmPbfFormatError(`Unsupported required features: ${unsupported.join(', ')}`);
  }
  return header;
}

interface BlockContext {
  strings: string[];
  granularity: number;
  latOffset: number;
  lonOffset: number;
  dateGranularity: number;
}

function decodePrimitiveBlock(bytes: Uint8Array, handlers: OsmPbfHandlers): void {
  const reader = new ProtobufReader(bytes);
  const context: BlockContext = {
    strings: [],
    granularity: 100,
    latOffset: 0,
    lonOffset: 0,
    dateGranularity: 1000,
  };
  const groups: Uint8Array[] = [];

  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    switch (field) {
      case 1:
        context.strings = decodeStringTable(reader.readBytes());
        break;
      case 2:
        groups.push(reader.readBytes());
        break;
      case 17:
        context.granularity = reader.readVarint();
        break;
      case 18:
        context.dateGranularity = reader.readVarint();
        break;
      case 19:
        context.latOffset = reader.readVarint();
        break;
      case 20:
        context.lonOffset = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
    }
  }

  for (const group of groups) decodePrimitiveGroup(group, context, handlers);
}

function decodeStringTable(bytes: Uint8Array): string[] {
  const reader = new ProtobufReader(bytes);
  const strings: string[] = [];
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1) strings.push(reader.readString());
    else reader.skip(wireType);
  }
  return strings;
}

function decodePrimitiveGroup(
  bytes: Uint8Array,
  context: BlockContext,
  handlers: OsmPbfHandlers,
): void {
  const reader = new ProtobufReader(bytes);
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1 && handlers.node !== undefined) {
      handlers.node(decodeNode(reader.readBytes(), context));
    } else if (field === 2 && handlers.node !== undefined) {
      decodeDenseNodes(reader.readBytes(), context, handlers.node);
    } else if (field === 3 && handlers.way !== undefined) {
      handlers.way(decodeWay(reader.readBytes(), context));
    } else if (field === 4 && handlers.relation !== undefined) {
      handlers.relation(decodeRelation(reader.readBytes(), context));
    } else {
      reader.skip(wireType);
    }
  }
}

function coordinate(value: number, offset: number, granularity: number): number {
  // Round to the 1e-7 degree precision used by OSM to avoid float noise.
  return Math.round((offset + granularity * value) / 100) / 1e7;
}

function tagsFrom(keys: number[], values: number[], strings: string[]): OsmTags {
  if (keys.length === 0) return EMPTY_TAGS;
  if (keys.length !== values.length) throw new OsmPbfFormatError('Tag keys and values differ');
  const tags: Record<string, string> = {};
  for (let index = 0; index < keys.length; index += 1) {
    tags[stringAt(strings, keys[index])] = stringAt(strings, values[index]);
  }
  return tags;
}

function stringAt(strings: string[], index: number | undefined): string {
  const value = index === undefined ? undefined : strings[index];
  if (value === undefined) throw new OsmPbfFormatError('String table index out of range');
  return value;
}

function decodeInfo(bytes: Uint8Array, context: BlockContext): OsmEntityMetadata {
  const reader = new ProtobufReader(bytes);
  let version: number | null = null;
  let timestamp: number | null = null;
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1) version = reader.readVarint();
    else if (field === 2) timestamp = reader.readVarint() * context.dateGranularity;
    else reader.skip(wireType);
  }
  return { version, timestamp };
}

function decodeNode(bytes: Uint8Array, context: BlockContext): OsmNode {
  const reader = new ProtobufReader(bytes);
  let id = 0;
  let lat = 0;
  let lon = 0;
  let keys: number[] = [];
  let values: number[] = [];
  let info: OsmEntityMetadata = { version: null, timestamp: null };
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1) id = reader.readSignedVarint();
    else if (field === 2) keys = reader.readPackedVarints();
    else if (field === 3) values = reader.readPackedVarints();
    else if (field === 4) info = decodeInfo(reader.readBytes(), context);
    else if (field === 8) lat = reader.readSignedVarint();
    else if (field === 9) lon = reader.readSignedVarint();
    else reader.skip(wireType);
  }
  return {
    type: 'node',
    id,
    lat: coordinate(lat, context.latOffset, context.granularity),
    lon: coordinate(lon, context.lonOffset, context.granularity),
    tags: tagsFrom(keys, values, context.strings),
    ...info,
  };
}

function decodeDenseNodes(
  bytes: Uint8Array,
  context: BlockContext,
  onNode: (node: OsmNode) => void,
): void {
  const reader = new ProtobufReader(bytes);
  let ids: number[] = [];
  let lats: number[] = [];
  let lons: number[] = [];
  let keysValues: number[] = [];
  let versions: number[] = [];
  let timestamps: number[] = [];
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1) ids = reader.readPackedSignedVarints();
    else if (field === 5) ({ versions, timestamps } = decodeDenseInfo(reader.readBytes()));
    else if (field === 8) lats = reader.readPackedSignedVarints();
    else if (field === 9) lons = reader.readPackedSignedVarints();
    else if (field === 10) keysValues = reader.readPackedVarints();
    else reader.skip(wireType);
  }
  if (lats.length !== ids.length || lons.length !== ids.length) {
    throw new OsmPbfFormatError('Dense node arrays have different lengths');
  }

  let id = 0;
  let lat = 0;
  let lon = 0;
  let timestamp = 0;
  let tagCursor = 0;
  for (let index = 0; index < ids.length; index += 1) {
    id += ids[index] ?? 0;
    lat += lats[index] ?? 0;
    lon += lons[index] ?? 0;
    timestamp += timestamps[index] ?? 0;

    let tags: OsmTags = EMPTY_TAGS;
    if (keysValues.length > 0) {
      const collected: Record<string, string> = {};
      let hasTags = false;
      while (tagCursor < keysValues.length && keysValues[tagCursor] !== 0) {
        collected[stringAt(context.strings, keysValues[tagCursor])] = stringAt(
          context.strings,
          keysValues[tagCursor + 1],
        );
        tagCursor += 2;
        hasTags = true;
      }
      tagCursor += 1;
      if (hasTags) tags = collected;
    }

    onNode({
      type: 'node',
      id,
      lat: coordinate(lat, context.latOffset, context.granularity),
      lon: coordinate(lon, context.lonOffset, context.granularity),
      tags,
      version: versions[index] ?? null,
      timestamp: timestamps.length > 0 ? timestamp * context.dateGranularity : null,
    });
  }
}

function decodeDenseInfo(bytes: Uint8Array): { versions: number[]; timestamps: number[] } {
  const reader = new ProtobufReader(bytes);
  let versions: number[] = [];
  let timestamps: number[] = [];
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1 && wireType === WireType.lengthDelimited) versions = reader.readPackedVarints();
    else if (field === 2 && wireType === WireType.lengthDelimited) {
      timestamps = reader.readPackedSignedVarints();
    } else reader.skip(wireType);
  }
  return { versions, timestamps };
}

function decodeWay(bytes: Uint8Array, context: BlockContext): OsmWay {
  const reader = new ProtobufReader(bytes);
  let id = 0;
  let keys: number[] = [];
  let values: number[] = [];
  let info: OsmEntityMetadata = { version: null, timestamp: null };
  let refs: number[] = [];
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1) id = reader.readVarint();
    else if (field === 2) keys = reader.readPackedVarints();
    else if (field === 3) values = reader.readPackedVarints();
    else if (field === 4) info = decodeInfo(reader.readBytes(), context);
    else if (field === 8) refs = accumulate(reader.readPackedSignedVarints());
    else reader.skip(wireType);
  }
  return { type: 'way', id, refs, tags: tagsFrom(keys, values, context.strings), ...info };
}

function decodeRelation(bytes: Uint8Array, context: BlockContext): OsmRelation {
  const reader = new ProtobufReader(bytes);
  let id = 0;
  let keys: number[] = [];
  let values: number[] = [];
  let info: OsmEntityMetadata = { version: null, timestamp: null };
  let roles: number[] = [];
  let memberIds: number[] = [];
  let memberTypes: number[] = [];
  while (!reader.done) {
    const { field, wireType } = reader.readTag();
    if (field === 1) id = reader.readVarint();
    else if (field === 2) keys = reader.readPackedVarints();
    else if (field === 3) values = reader.readPackedVarints();
    else if (field === 4) info = decodeInfo(reader.readBytes(), context);
    else if (field === 8) roles = reader.readPackedVarints();
    else if (field === 9) memberIds = accumulate(reader.readPackedSignedVarints());
    else if (field === 10) memberTypes = reader.readPackedVarints();
    else reader.skip(wireType);
  }
  if (roles.length !== memberIds.length || memberTypes.length !== memberIds.length) {
    throw new OsmPbfFormatError('Relation member arrays have different lengths');
  }
  const members = memberIds.map((ref, index) => {
    const type = MEMBER_TYPES[memberTypes[index] ?? -1];
    if (type === undefined) throw new OsmPbfFormatError('Unknown relation member type');
    return { type, ref, role: stringAt(context.strings, roles[index]) };
  });
  return { type: 'relation', id, members, tags: tagsFrom(keys, values, context.strings), ...info };
}

function accumulate(deltas: number[]): number[] {
  let current = 0;
  return deltas.map((delta) => (current += delta));
}
