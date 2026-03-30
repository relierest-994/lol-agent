import { asString, readRequestBody, writeJson } from '../http/http-utils';
import type { RouteHandler } from './types';

export const handleReviewRoutes: RouteHandler = async (context, services) => {
  const { orchestrator, provider } = services;

  if (context.method === 'POST' && context.path === 'agent/run') {
    const body = await readRequestBody(context);
    const userId = asString(body.userId);
    const userInput = asString(body.userInput);
    const output = await orchestrator.run({
      userId: asString(body.userId),
      region: (asString(body.region) || 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN',
      userInput,
      preferredMatchId: asString(body.preferredMatchId, '') || undefined,
      linkedAccount: body.linkedAccount as never,
      uploadedClip: body.uploadedClip as never,
    });
    services.recordTaskRun({
      userId,
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      intent: 'AGENT_RUN',
      status: output?.error ? 'FAILED' : 'COMPLETED',
      payload: {
        userInput,
        region: body.region,
        hasLinkedAccount: Boolean(body.linkedAccount),
        hasUploadedClip: Boolean(body.uploadedClip),
      },
      errorCode: typeof output?.errorCode === 'string' ? output.errorCode : undefined,
    });
    writeJson(context.res, 200, output);
    return true;
  }

  if (context.method === 'POST' && context.path === 'reviews/basic/generate') {
    const body = await readRequestBody(context);
    const report = await provider.generateBasicReview(body.match as never, asString(body.now_iso, new Date().toISOString()));
    writeJson(context.res, 200, report);
    return true;
  }

  if (context.method === 'POST' && context.path === 'reviews/deep/generate') {
    const body = await readRequestBody(context);
    const generated = await provider.generateDeepReview({
      userId: asString(body.user_id),
      region: asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN',
      accountId: asString(body.account_id),
      matchId: asString(body.match_id),
      focusDimensions: body.focus_dimensions as never,
      authorizationContext: (body.authorization_context as never) ?? { entitlement_checked: true },
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, generated);
    return true;
  }

  if (context.method === 'POST' && context.path === 'reviews/deep/status') {
    const body = await readRequestBody(context);
    const status = await provider.getDeepReviewStatus({
      userId: asString(body.user_id),
      matchId: asString(body.match_id),
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, status);
    return true;
  }

  if (context.method === 'POST' && context.path === 'reviews/deep/result') {
    const body = await readRequestBody(context);
    const result = await provider.getDeepReviewResult({
      userId: asString(body.user_id),
      matchId: asString(body.match_id),
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, result ?? null);
    return true;
  }

  if (context.method === 'POST' && context.path === 'reviews/ask/match') {
    const body = await readRequestBody(context);
    const answer = await provider.askMatchQuestion({
      userId: asString(body.user_id),
      region: asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN',
      matchId: asString(body.match_id),
      question: asString(body.question),
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, answer);
    return true;
  }

  if (context.method === 'POST' && context.path === 'reviews/ask/suggested-prompts') {
    const body = await readRequestBody(context);
    const prompts = await provider.listSuggestedPrompts({
      userId: asString(body.user_id),
      matchId: asString(body.match_id),
      nowIso: asString(body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, prompts);
    return true;
  }

  return false;
};
