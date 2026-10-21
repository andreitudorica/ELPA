import { describe, expect, it } from 'vitest';

import { UnionFind } from './union-find';

describe('stable related-record grouping', () => {
  it('keeps lexical representatives independent of link order and repeated links', () => {
    const forward = new UnionFind();
    const reverse = new UnionFind();
    const edges = [
      ['c', 'b'],
      ['b', 'a'],
      ['x', 'y'],
    ] as const;
    for (const [left, right] of edges) forward.union(left, right);
    for (const [left, right] of [...edges].reverse()) reverse.union(right, left);
    forward.union('a', 'c');
    forward.union('a', 'a');
    for (const id of ['a', 'b', 'c']) {
      expect(forward.find(id)).toBe('a');
      expect(reverse.find(id)).toBe('a');
    }
    expect(forward.count(['a', 'b', 'c', 'x', 'y', 'unrelated'])).toBe(3);
    expect(forward.find('unrelated')).toBe('unrelated');
  });

  it('handles long transitive chains without recursive traversal', () => {
    const groups = new UnionFind();
    const key = (n: number) => `source:${String(n).padStart(5, '0')}`;
    for (let n = 12_000; n > 0; n -= 1) groups.union(key(n), key(n - 1));
    expect(groups.find(key(12_000))).toBe(key(0));
    expect(groups.find(key(6_000))).toBe(key(0));
  });
});
