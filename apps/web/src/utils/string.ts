/** "Ada Lovelace" -> "AL"; falls back to the first two characters. */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') {
    return '?';
  }
  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (first !== undefined && last !== undefined) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/** Truncates to `maxLength` characters, appending an ellipsis when shortened. */
export function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
