export interface PersistentStateStore {
  read<T>(key: string): T | undefined;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
}

class BrowserLocalStorageStore implements PersistentStateStore {
  private readonly runtimeFallback: Map<string, string>;

  constructor(private readonly namespace: string) {
    const runtime = globalThis as { __LOL_AGENT_PERSISTENT_STORE__?: Map<string, string> };
    if (!runtime.__LOL_AGENT_PERSISTENT_STORE__) runtime.__LOL_AGENT_PERSISTENT_STORE__ = new Map<string, string>();
    this.runtimeFallback = runtime.__LOL_AGENT_PERSISTENT_STORE__;
  }

  read<T>(key: string): T | undefined {
    const scopedKey = `${this.namespace}:${key}`;
    try {
      const raw = globalThis.localStorage?.getItem(scopedKey);
      if (!raw) {
        const fallbackRaw = this.runtimeFallback.get(scopedKey);
        if (!fallbackRaw) return undefined;
        return JSON.parse(fallbackRaw) as T;
      }
      return JSON.parse(raw) as T;
    } catch {
      try {
        const fallbackRaw = this.runtimeFallback.get(scopedKey);
        if (!fallbackRaw) return undefined;
        return JSON.parse(fallbackRaw) as T;
      } catch {
        return undefined;
      }
    }
  }

  write<T>(key: string, value: T): void {
    const scopedKey = `${this.namespace}:${key}`;
    const serialized = JSON.stringify(value);
    this.runtimeFallback.set(scopedKey, serialized);
    try {
      globalThis.localStorage?.setItem(scopedKey, serialized);
    } catch {
      // keep runtime fallback when persistent backend is temporarily unavailable
    }
  }

  remove(key: string): void {
    const scopedKey = `${this.namespace}:${key}`;
    this.runtimeFallback.delete(scopedKey);
    try {
      globalThis.localStorage?.removeItem(scopedKey);
    } catch {
      // ignore persistent backend removal errors
    }
  }
}

class RuntimeGlobalStore implements PersistentStateStore {
  private readonly map: Map<string, string>;

  constructor(private readonly namespace: string) {
    const runtime = globalThis as { __LOL_AGENT_PERSISTENT_STORE__?: Map<string, string> };
    if (!runtime.__LOL_AGENT_PERSISTENT_STORE__) runtime.__LOL_AGENT_PERSISTENT_STORE__ = new Map<string, string>();
    this.map = runtime.__LOL_AGENT_PERSISTENT_STORE__;
  }

  read<T>(key: string): T | undefined {
    const raw = this.map.get(`${this.namespace}:${key}`);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  write<T>(key: string, value: T): void {
    this.map.set(`${this.namespace}:${key}`, JSON.stringify(value));
  }

  remove(key: string): void {
    this.map.delete(`${this.namespace}:${key}`);
  }
}

function resolveAppEnv(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return env.APP_ENV ?? env.NODE_ENV ?? 'dev';
}

export function createPersistentStateStore(scope: string): PersistentStateStore {
  const namespace = `lol-agent:${resolveAppEnv()}:${scope}`;
  if (typeof globalThis.localStorage !== 'undefined') return new BrowserLocalStorageStore(namespace);
  return new RuntimeGlobalStore(namespace);
}

export function clearPersistentState(scope: string): void {
  const store = createPersistentStateStore(scope);
  store.remove('state');
}
