export interface ServerConfig {
  port: number;
}

export function loadServerConfig(): ServerConfig {
  const portRaw = Number(process.env.PORT ?? 8080);
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 8080;
  return { port };
}

