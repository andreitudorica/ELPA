import { describe, expect, it } from 'vitest';

import { getInitials, truncate } from './string';

describe('getInitials', () => {
  it('uses the first and last word', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
    expect(getInitials('Grace Brewster Murray Hopper')).toBe('GH');
  });

  it('falls back for single words and empty input', () => {
    expect(getInitials('Plato')).toBe('PL');
    expect(getInitials('   ')).toBe('?');
  });
});

describe('truncate', () => {
  it('shortens long values with an ellipsis and keeps short ones', () => {
    expect(truncate('Hello world', 8)).toBe('Hello w…');
    expect(truncate('Hi', 8)).toBe('Hi');
  });
});
