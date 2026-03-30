export interface PersistentStateStore {
  read<T>(key: string): T | undefined;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
}

class BrowserLocalStorageStore implements PersistentStateStore {
  constructor(private readonly namespace: string) {}

  read<T>(key: string): T | undefined {
    try {
      const raw = globalThis.localStorage?.getItem(`${this.namespace}:${key}`);
      if (!raw) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  write<T>(key: string, value: T): void {
    globalThis.localStorage?.setItem(`${this.namespace}:${key}`, JSON.stringify(value));
  }

  remove(key: string): void {
    globalThis.localStorage?.removeItem(`${this.namespace}:${key}`);
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
