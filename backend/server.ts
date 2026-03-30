import { createServer } from 'node:http';
import { URL } from 'node:url';

// Backend must execute local capability/business logic and expose API to frontend shell.
process.env.APP_PROVIDER_MODE = 'mock';
process.env.VITE_APP_PROVIDER_MODE = 'mock';

const { AgentOrchestrator } = await import('../src/agent/orchestrator/agent-orchestrator');
const { MockCapabilityProvider } = await import('../src/capabilities/toolkit/providers/mock-capability.provider');
const { paymentWebhookService } = await import('../src/application/services/payment-webhook.service');
const { getLocalJobQueueRuntime } = await import('../src/infrastructure/queue/job-queue.runtime');

const orchestrator = new AgentOrchestrator();
const provider = new MockCapabilityProvider();

const port = Number(process.env.PORT ?? 8080);

type JsonBody = Record<string, unknown>;

function writeJson(res: import('node:http').ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.end(JSON.stringify(data));
}

async function readBody(req: import('node:http').IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonBody;
  } catch {
    return {};
  }
}

function asString(input: unknown, fallback = ''): string {
  return typeof input === 'string' ? input : fallback;
}

async function runQueueTick(): Promise<void> {
  await getLocalJobQueueRuntime().processDueJobs();
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    writeJson(res, 400, { error: 'Bad request' });
    return;
  }

  if (req.method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  await runQueueTick();

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/^\/+/, '');

  try {
    if (req.method === 'GET' && path === 'health') {
      writeJson(res, 200, { ok: true, service: 'lol-agent-backend', now: new Date().toISOString() });
      return;
    }

    if (req.method === 'POST' && path === 'agent/run') {
      const body = await readBody(req);
      const output = await orchestrator.run({
        userId: asString(body.userId),
        region: (asString(body.region) || 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN',
        userInput: asString(body.userInput),
        linkedAccount: body.linkedAccount as never,
        uploadedClip: body.uploadedClip as never,
      });
      writeJson(res, 200, output);
      return;
    }

    if (req.method === 'GET' && path === 'infra/db/health') {
      writeJson(res, 200, { ok: true, engine: 'postgres', version: '16', latency_ms: 1 });
      return;
    }

    if (req.method === 'GET' && path === 'accounts/linked') {
      const account = await provider.getLinkedAccount(
        asString(url.searchParams.get('user_id')),
        (asString(url.searchParams.get('region'), 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN')
      );
      writeJson(res, 200, account ?? null);
      return;
    }

    if (req.method === 'POST' && path === 'accounts/link/mock') {
      const body = await readBody(req);
      const account = await provider.linkMockAccount(
        asString(body.user_id),
        (asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN')
      );
      writeJson(res, 200, account);
      return;
    }

    if (req.method === 'POST' && path === 'matches/recent') {
      const body = await readBody(req);
      const data = await provider.listRecentMatches(
        (asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN'),
        asString(body.account_id),
        Number(body.limit ?? 5)
      );
      writeJson(res, 200, data);
      return;
    }

    if (req.method === 'GET' && path.startsWith('matches/')) {
      const matchId = decodeURIComponent(path.slice('matches/'.length));
      const region = asString(url.searchParams.get('region'), 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN';
      const detail = await provider.getMatchDetail(region, matchId);
      writeJson(res, 200, detail ?? null);
      return;
    }

    if (req.method === 'POST' && path === 'reviews/basic/generate') {
      const body = await readBody(req);
      const report = await provider.generateBasicReview(body.match as never, asString(body.now_iso, new Date().toISOString()));
      writeJson(res, 200, report);
      return;
    }

    if (req.method === 'POST' && path === 'reviews/deep/generate') {
      const body = await readBody(req);
      const generated = await provider.generateDeepReview({
        userId: asString(body.user_id),
        region: asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN',
        accountId: asString(body.account_id),
        matchId: asString(body.match_id),
        focusDimensions: body.focus_dimensions as never,
        authorizationContext: (body.authorization_context as never) ?? { entitlement_checked: true },
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, generated);
      return;
    }

    if (req.method === 'POST' && path === 'reviews/deep/status') {
      const body = await readBody(req);
      const status = await provider.getDeepReviewStatus({
        userId: asString(body.user_id),
        matchId: asString(body.match_id),
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, status);
      return;
    }

    if (req.method === 'POST' && path === 'reviews/deep/result') {
      const body = await readBody(req);
      const result = await provider.getDeepReviewResult({
        userId: asString(body.user_id),
        matchId: asString(body.match_id),
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, result ?? null);
      return;
    }

    if (req.method === 'POST' && path === 'reviews/ask/match') {
      const body = await readBody(req);
      const answer = await provider.askMatchQuestion({
        userId: asString(body.user_id),
        region: asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN',
        matchId: asString(body.match_id),
        question: asString(body.question),
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, answer);
      return;
    }

    if (req.method === 'POST' && path === 'reviews/ask/suggested-prompts') {
      const body = await readBody(req);
      const prompts = await provider.listSuggestedPrompts({
        userId: asString(body.user_id),
        matchId: asString(body.match_id),
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, prompts);
      return;
    }

    if (req.method === 'POST' && path === 'video/assets/upload') {
      const body = await readBody(req);
      const uploaded = await provider.uploadVideoAsset({
        user_id: asString(body.user_id),
        match_id: asString(body.match_id),
        file_name: asString(body.file_name),
        mime_type: asString(body.mime_type),
        size_bytes: Number(body.size_bytes ?? 0),
        duration_seconds: Number(body.duration_seconds ?? 0),
        nowIso: asString(body.nowIso ?? body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, uploaded);
      return;
    }

    if (req.method === 'GET' && path.startsWith('video/assets/')) {
      const assetId = decodeURIComponent(path.slice('video/assets/'.length));
      const asset = await provider.getVideoAsset(assetId);
      writeJson(res, 200, asset ?? null);
      return;
    }

    if (req.method === 'POST' && path === 'video/tasks/create') {
      const body = await readBody(req);
      const region = asString((body as Record<string, unknown>).region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN';
      const match =
        (body.match as never) ??
        (await provider.getMatchDetail(region, asString(body.match_id)));
      if (!match) {
        writeJson(res, 400, { ok: false, error: 'match not found' });
        return;
      }
      const deep =
        (body.deepReview as never) ??
        (await provider.getDeepReviewResult({
          userId: asString(body.user_id),
          matchId: asString(body.match_id),
          nowIso: asString(body.nowIso ?? body.now_iso, new Date().toISOString()),
        }));
      const created = await provider.createVideoDiagnosisTask({
        user_id: asString(body.user_id),
        match_id: asString(body.match_id),
        asset_id: asString(body.asset_id),
        natural_language_question: asString(body.natural_language_question),
        entitlement_context: (body.entitlement_context as never) ?? { entitlement_checked: true },
        match,
        deepReview: deep,
        nowIso: asString(body.nowIso ?? body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, created);
      return;
    }

    if (req.method === 'POST' && path === 'video/tasks/run') {
      const body = await readBody(req);
      await provider.runVideoDiagnosisTask(asString(body.task_id), {
        nowIso: asString(body.now_iso, new Date().toISOString()),
        match: body.match as never,
        deepReview: body.deep_review as never,
      });
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && path === 'video/tasks/run-from-queue') {
      const body = await readBody(req);
      const region = asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN';
      const match = await provider.getMatchDetail(region, asString(body.match_id));
      if (!match) {
        writeJson(res, 400, { ok: false, error: 'match not found' });
        return;
      }
      const deep = await provider.getDeepReviewResult({
        userId: asString(body.user_id),
        matchId: asString(body.match_id),
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      await provider.runVideoDiagnosisTask(asString(body.task_id), {
        nowIso: asString(body.now_iso, new Date().toISOString()),
        match,
        deepReview: deep,
      });
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && path.startsWith('video/tasks/')) {
      const taskId = decodeURIComponent(path.slice('video/tasks/'.length));
      const task = await provider.getVideoDiagnosisTask(taskId);
      writeJson(res, 200, task ?? null);
      return;
    }

    if (req.method === 'GET' && path === 'video/tasks/latest') {
      const task = await provider.getLatestVideoDiagnosisTask(
        asString(url.searchParams.get('user_id')),
        asString(url.searchParams.get('match_id'))
      );
      writeJson(res, 200, task ?? null);
      return;
    }

    if (req.method === 'GET' && path.startsWith('video/results/by-task/')) {
      const taskId = decodeURIComponent(path.slice('video/results/by-task/'.length));
      const result = await provider.getVideoDiagnosisResultByTask(taskId);
      writeJson(res, 200, result ?? null);
      return;
    }

    if (req.method === 'GET' && path === 'video/results/latest') {
      const result = await provider.getLatestVideoDiagnosisResult(
        asString(url.searchParams.get('user_id')),
        asString(url.searchParams.get('match_id'))
      );
      writeJson(res, 200, result ?? null);
      return;
    }

    if (req.method === 'GET' && path === 'entitlements/current') {
      const userId = asString(url.searchParams.get('user_id'));
      const nowIso = asString(url.searchParams.get('now_iso'), new Date().toISOString());
      const state = await provider.getEntitlement(userId);
      const snapshot = await provider.getBillingSnapshot(userId, nowIso);
      writeJson(res, 200, { state, snapshot });
      return;
    }

    if (req.method === 'GET' && path === 'entitlements/state') {
      const state = await provider.getEntitlement(asString(url.searchParams.get('user_id')));
      writeJson(res, 200, state);
      return;
    }

    if (req.method === 'POST' && path === 'entitlements/check') {
      const body = await readBody(req);
      const decision = await provider.checkFeatureAccess(
        asString(body.user_id),
        asString(body.feature_code) as never,
        asString(body.now_iso, new Date().toISOString())
      );
      writeJson(res, 200, decision);
      return;
    }

    if (req.method === 'POST' && path === 'entitlements/explain') {
      const body = await readBody(req);
      const explained = await provider.explainFeatureAccess(
        asString(body.user_id),
        asString(body.feature_code) as never,
        asString(body.now_iso, new Date().toISOString())
      );
      writeJson(res, 200, explained);
      return;
    }

    if (req.method === 'POST' && path === 'entitlements/consume') {
      const body = await readBody(req);
      const consumed = await provider.consumeFeatureUsage({
        userId: asString(body.user_id),
        featureCode: asString(body.feature_code) as never,
        usageKey: asString(body.usage_key),
        operationStatus: asString(body.operation_status, 'FAILED') as 'SUCCESS' | 'FAILED',
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, consumed);
      return;
    }

    if (req.method === 'POST' && path === 'payments/order/create') {
      const body = await readBody(req);
      const created = await provider.createUnlockOrder({
        userId: asString(body.user_id),
        planCode: asString(body.plan_code),
        featureCode: (body.feature_code as never) ?? undefined,
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, created);
      return;
    }

    if (req.method === 'POST' && path === 'payments/order/confirm') {
      const body = await readBody(req);
      const confirmed = await provider.confirmUnlockOrder({
        orderId: asString(body.order_id),
        transactionId: asString(body.transaction_id),
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, confirmed);
      return;
    }

    if (req.method === 'POST' && path === 'payments/checkout/create') {
      const body = await readBody(req);
      const checkout = await paymentWebhookService.createCheckout({
        user_id: asString(body.user_id),
        order_id: asString(body.order_id),
        amount_cents: Number(body.amount_cents ?? 0),
        currency: asString(body.currency, 'CNY') as 'CNY' | 'USD',
        plan_code: asString(body.plan_code),
        feature_code: body.feature_code as never,
        return_url: asString(body.return_url),
      });
      writeJson(res, 200, checkout);
      return;
    }

    if (req.method === 'POST' && path === 'payments/callback') {
      const body = await readBody(req);
      const callback = await paymentWebhookService.handleCallback({
        provider: asString(body.provider, 'STRIPE') as 'STRIPE' | 'ALIPAY' | 'WECHAT_PAY',
        event_id: asString(body.event_id),
        order_id: asString(body.order_id),
        transaction_id: asString(body.transaction_id),
        status: asString(body.status, 'FAILED') as 'SUCCEEDED' | 'FAILED',
        amount_cents: Number(body.amount_cents ?? 0),
        currency: asString(body.currency, 'CNY'),
        timestamp: asString(body.timestamp, new Date().toISOString()),
        signature: asString(body.signature),
        raw_payload: (body.raw_payload as Record<string, unknown>) ?? {},
        nowIso: asString(body.now_iso, new Date().toISOString()),
      });
      writeJson(res, 200, callback);
      return;
    }

    if (req.method === 'POST' && path === 'payments/snapshot') {
      const body = await readBody(req);
      const snapshot = await provider.getBillingSnapshot(
        asString(body.user_id),
        asString(body.now_iso, new Date().toISOString())
      );
      writeJson(res, 200, snapshot);
      return;
    }

    writeJson(res, 404, { error: 'Not found', path });
  } catch (error) {
    writeJson(res, 500, {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown',
    });
  }
});

server.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});

