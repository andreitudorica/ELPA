import { unzipSync } from 'fflate';
import { SaxesParser } from 'saxes';

/**
 * Reads the first worksheet of an Office Open XML workbook as rows of cell
 * strings. Cells are positioned by their `r` reference, so sparse rows keep
 * their columns. Only the features used by machine-generated exports are
 * supported: shared strings, inline strings, and plain values.
 */
export class XlsxFormatError extends Error {}

export type SheetRow = (string | null)[];

const textDecoder = new TextDecoder('utf-8', { fatal: true });

export function readFirstWorksheet(workbook: Uint8Array): SheetRow[] {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(workbook, {
      filter: (file) =>
        file.name === 'xl/workbook.xml' ||
        file.name === 'xl/_rels/workbook.xml.rels' ||
        file.name === 'xl/sharedStrings.xml' ||
        file.name.startsWith('xl/worksheets/'),
    });
  } catch (error) {
    throw new XlsxFormatError('Artifact is not a readable ZIP/XLSX package', { cause: error });
  }

  const sheetPath = firstSheetPath(entries);
  const sheet = entries[sheetPath];
  if (sheet === undefined) throw new XlsxFormatError(`Worksheet ${sheetPath} is missing`);
  const sharedStringsEntry = entries['xl/sharedStrings.xml'];
  const sharedStrings =
    sharedStringsEntry === undefined ? [] : readSharedStrings(sharedStringsEntry);
  return readSheet(sheet, sharedStrings);
}

function decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

/** Element name without its namespace prefix (`x:row` and `row` are equivalent). */
function local(name: string): string {
  const separator = name.indexOf(':');
  return separator === -1 ? name : name.slice(separator + 1);
}

function parse(xml: Uint8Array, handlers: (parser: SaxesParser) => void): void {
  const parser = new SaxesParser();
  handlers(parser);
  try {
    parser.write(decode(xml)).close();
  } catch (error) {
    throw new XlsxFormatError('Malformed XML in workbook part', { cause: error });
  }
}

function firstSheetPath(entries: Record<string, Uint8Array>): string {
  const workbook = entries['xl/workbook.xml'];
  const relationships = entries['xl/_rels/workbook.xml.rels'];
  if (workbook === undefined || relationships === undefined) {
    throw new XlsxFormatError('Workbook manifest is missing');
  }

  let relationshipId: string | undefined;
  parse(workbook, (parser) => {
    parser.on('opentag', (node) => {
      if (relationshipId === undefined && local(node.name) === 'sheet') {
        const id = node.attributes['r:id'];
        relationshipId = typeof id === 'string' ? id : undefined;
      }
    });
  });

  let target: string | undefined;
  parse(relationships, (parser) => {
    parser.on('opentag', (node) => {
      if (local(node.name) === 'Relationship' && node.attributes.Id === relationshipId) {
        const value = node.attributes.Target;
        target = typeof value === 'string' ? value : undefined;
      }
    });
  });
  if (target === undefined) throw new XlsxFormatError('First worksheet relationship is missing');
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

function readSharedStrings(xml: Uint8Array): string[] {
  const strings: string[] = [];
  let current: string[] | null = null;
  let inText = false;
  let phoneticDepth = 0;
  parse(xml, (parser) => {
    parser.on('opentag', (node) => {
      if (local(node.name) === 'si') current = [];
      else if (local(node.name) === 'rPh') phoneticDepth += 1;
      else if (local(node.name) === 't' && phoneticDepth === 0) inText = true;
    });
    parser.on('text', (text) => {
      if (inText && current !== null) current.push(text);
    });
    parser.on('closetag', (node) => {
      if (local(node.name) === 't') inText = false;
      else if (local(node.name) === 'rPh') phoneticDepth -= 1;
      else if (local(node.name) === 'si' && current !== null) {
        strings.push(current.join(''));
        current = null;
      }
    });
  });
  return strings;
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0];
  if (letters === undefined) throw new XlsxFormatError(`Invalid cell reference ${reference}`);
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function readSheet(xml: Uint8Array, sharedStrings: string[]): SheetRow[] {
  const rows: SheetRow[] = [];
  let row: SheetRow | null = null;
  let cell: { column: number; type: string | null; text: string[] } | null = null;
  let inValue = false;
  parse(xml, (parser) => {
    parser.on('opentag', (node) => {
      if (local(node.name) === 'row') {
        row = [];
      } else if (local(node.name) === 'c' && row !== null) {
        const reference = node.attributes.r;
        const type = node.attributes.t;
        cell = {
          column: typeof reference === 'string' ? columnIndex(reference) : row.length,
          type: typeof type === 'string' ? type : null,
          text: [],
        };
      } else if ((local(node.name) === 'v' || local(node.name) === 't') && cell !== null) {
        inValue = true;
      }
    });
    parser.on('text', (text) => {
      if (inValue && cell !== null) cell.text.push(text);
    });
    parser.on('closetag', (node) => {
      if (local(node.name) === 'v' || local(node.name) === 't') {
        inValue = false;
      } else if (local(node.name) === 'c' && cell !== null && row !== null) {
        const raw = cell.text.join('');
        let value: string | null = cell.text.length === 0 ? null : raw;
        if (cell.type === 's' && value !== null) {
          const shared = sharedStrings[Number(value)];
          if (shared === undefined) throw new XlsxFormatError(`Missing shared string ${raw}`);
          value = shared;
        }
        while (row.length < cell.column) row.push(null);
        row[cell.column] = value;
        cell = null;
      } else if (local(node.name) === 'row' && row !== null) {
        rows.push(row);
        row = null;
      }
    });
  });
  return rows;
}
