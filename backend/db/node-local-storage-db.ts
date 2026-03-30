import { getKv, removeKv, setKv } from './psql-client';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

class DbBackedLocalStorage implements StorageLike {
  private readonly namespace = 'global_local_storage';
  private readonly keyIndex = new Set<string>();

  getItem(key: string): string | null {
    const value = getKv(this.namespace, key);
    return value ?? null;
  }

  setItem(key: string, value: string): void {
    setKv(this.namespace, key, value);
    this.keyIndex.add(key);
  }

  removeItem(key: string): void {
    removeKv(this.namespace, key);
    this.keyIndex.delete(key);
  }

  clear(): void {
    for (const key of [...this.keyIndex]) {
      this.removeItem(key);
    }
  }

  key(index: number): string | null {
    return [...this.keyIndex][index] ?? null;
  }

  get length(): number {
    return this.keyIndex.size;
  }
}

export function installDbBackedLocalStorage(): void {
  const runtime = globalThis as unknown as { localStorage?: StorageLike };
  runtime.localStorage = new DbBackedLocalStorage();
}
