import { createServer } from 'node:http';
import { createBackendAppContext } from './app-context';
import { loadServerConfig } from './config/server-config';
import { buildRequestContext, writeJson } from './http/http-utils';
import { routeHandlers } from './routes';

const config = loadServerConfig();
const services = await createBackendAppContext();

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    writeJson(res, 400, { error: 'Bad request' });
    return;
  }

  if (req.method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  await services.runQueueTick();
  const context = buildRequestContext(req, res);

  try {
    for (const handler of routeHandlers) {
      const handled = await handler(context, services);
      if (handled) return;
    }

    writeJson(res, 404, { error: 'Not found', path: context.path });
  } catch (error) {
    writeJson(res, 500, {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

server.listen(config.port, () => {
  console.log(`[backend] listening on http://localhost:${config.port}`);
});

