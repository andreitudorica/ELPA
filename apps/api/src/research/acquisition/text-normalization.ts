/**
 * Deterministic text normalisation for Romanian source data.
 *
 * Romanian sources mix the legacy cedilla letters (ş, ţ) with the correct
 * comma-below letters (ș, ț), upper and lower case, and inconsistent
 * punctuation. Folding removes all combining marks after canonical
 * decomposition, so every variant compares equal. Folded strings are for
 * comparison only; Claims keep the source spelling.
 */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function foldTokens(value: string): string[] {
  const folded = foldText(value);
  return folded === '' ? [] : folded.split(' ');
}

/** Collapses whitespace and trims; keeps case and diacritics for display Claims. */
export function cleanDisplayText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned === '' || cleaned === '-' ? null : cleaned;
}

/**
 * Words that describe the kind of accommodation rather than identify it.
 * Removing them leaves the identifying "core" of a property name, so
 * "Pensiunea Casa Maria" and "Casa Maria" share the core `maria` while the
 * removed type words remain available as a separate matching signal.
 */
const PROPERTY_TYPE_WORDS = new Set([
  'agroturistic',
  'agroturistica',
  'apartament',
  'apartamente',
  'apartamentul',
  'apartment',
  'apartments',
  'bungalou',
  'bungalouri',
  'bungalow',
  'bungalows',
  'cabana',
  'cabane',
  'cabanuta',
  'cabin',
  'cabins',
  'camere',
  'camera',
  'camping',
  'casa',
  'case',
  'casuta',
  'casute',
  'chalet',
  'chalets',
  'complex',
  'complexul',
  'conac',
  'cottage',
  'guest',
  'guesthouse',
  'han',
  'hanul',
  'home',
  'homes',
  'hostel',
  'hotel',
  'hotelul',
  'house',
  'inn',
  'lodge',
  'motel',
  // Hungarian (Harghita, Covasna, Mureș): panzió, vendégház, kulcsosház.
  'panzio',
  'vendeghaz',
  'kulcsoshaz',
  'pensiune',
  'pensiunea',
  'popas',
  'residence',
  'resort',
  'rezidenta',
  'room',
  'rooms',
  'studio',
  'studiouri',
  'turistic',
  'turistica',
  'vila',
  'villa',
  'vile',
]);

const NAME_STOP_WORDS = new Set([
  'a',
  'al',
  'and',
  'cu',
  'de',
  'din',
  'in',
  'la',
  'lui',
  'of',
  'pe',
  'si',
  'the',
]);

/** Type words that suggest a self-contained dwelling rather than rooms. */
export const HOUSE_LIKE_TYPE_WORDS = new Set([
  'cabana',
  'cabane',
  'cabanuta',
  'cabin',
  'cabins',
  'casa',
  'casuta',
  'casute',
  'chalet',
  'chalets',
  'conac',
  'cottage',
  'house',
  'kulcsoshaz',
  'lodge',
  'vila',
  'villa',
]);

export interface NormalizedPropertyName {
  folded: string;
  /** Identifying tokens after removing type words and stop words. */
  coreTokens: string[];
  /** Type words present in the name, e.g. `casa`, `pensiunea`. */
  typeWords: string[];
}

export function normalizePropertyName(name: string): NormalizedPropertyName {
  const tokens = foldTokens(name);
  const coreTokens: string[] = [];
  const typeWords: string[] = [];
  for (const token of tokens) {
    if (PROPERTY_TYPE_WORDS.has(token)) typeWords.push(token);
    else if (!NAME_STOP_WORDS.has(token)) coreTokens.push(token);
  }
  return { folded: tokens.join(' '), coreTokens, typeWords: [...new Set(typeWords)].sort() };
}

/** Sørensen–Dice similarity over padded character trigrams, in [0, 1]. */
export function trigramSimilarity(left: string, right: string): number {
  if (left === '' || right === '') return 0;
  if (left === right) return 1;
  const leftGrams = trigrams(left);
  const rightGrams = trigrams(right);
  let overlap = 0;
  const remaining = new Map<string, number>();
  for (const gram of rightGrams) remaining.set(gram, (remaining.get(gram) ?? 0) + 1);
  for (const gram of leftGrams) {
    const count = remaining.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      remaining.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (leftGrams.length + rightGrams.length);
}

function trigrams(value: string): string[] {
  const padded = `  ${value} `;
  const grams: string[] = [];
  for (let index = 0; index < padded.length - 2; index += 1) {
    grams.push(padded.slice(index, index + 3));
  }
  return grams;
}

const STREET_TYPE_WORDS = new Set([
  'aleea',
  'al',
  'b',
  'bd',
  'bdul',
  'bulevardul',
  'calea',
  'cartier',
  'cartierul',
  'drum',
  'drumul',
  'fundatura',
  'intrarea',
  'piata',
  'prelungirea',
  'sos',
  'soseaua',
  'splaiul',
  'str',
  'strada',
  'ulita',
]);

/** Folded street name without its street-type prefix (`Strada`, `Calea`, ...). */
export function normalizeStreetName(street: string): string | null {
  const tokens = foldTokens(street);
  while (tokens.length > 1 && STREET_TYPE_WORDS.has(tokens[0] ?? '')) tokens.shift();
  const normalized = tokens.join(' ');
  return normalized === '' ? null : normalized;
}

export function normalizeHouseNumber(value: string): string | null {
  const normalized = foldText(value)
    .replace(/^(nr|numarul|no)\s+/, '')
    .replace(/\s+/g, '');
  return normalized === '' ? null : normalized;
}
