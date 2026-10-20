/** Minimal RFC 4180 CSV writing and parsing for review sheets. */

export type CsvValue = string | number | boolean | null | undefined;

export function toCsv(
  header: readonly string[],
  rows: readonly Record<string, CsvValue>[],
): string {
  const escape = (value: CsvValue) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${[header.join(','), ...rows.map((row) => header.map((key) => escape(row[key])).join(','))].join('\r\n')}\r\n`;
}

export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let index = 0; index < input.length; index += 1) {
    const character = input.charAt(index);
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [header, ...rows] = records.filter((row) => row.some((cell) => cell !== ''));
  if (header === undefined) return [];
  return rows.map((row) =>
    Object.fromEntries(header.map((key, column) => [key, row[column] ?? ''])),
  );
}
