/** Stable lexical representatives preserve reproducible sampling and report identities. */
export class UnionFind {
  private readonly parent = new Map<string, string>();

  find(id: string): string {
    let root = id;
    while (this.parent.has(root) && this.parent.get(root) !== root)
      root = this.parent.get(root) ?? root;
    let current = id;
    while (current !== root) {
      const next = this.parent.get(current) ?? root;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot)
      this.parent.set(
        leftRoot < rightRoot ? rightRoot : leftRoot,
        leftRoot < rightRoot ? leftRoot : rightRoot,
      );
  }

  count(ids: string[]): number {
    return new Set(ids.map((id) => this.find(id))).size;
  }
}
