export type BackendRuntimeMode = 'mock' | 'db';

export function loadBackendRuntimeMode(): BackendRuntimeMode {
  const raw = (process.env.APP_BACKEND_MODE ?? 'mock').toLowerCase();
  return raw === 'db' ? 'db' : 'mock';
}

