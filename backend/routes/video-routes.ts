import { asString, readRequestBody, writeJson } from '../http/http-utils';
import type { RouteHandler } from './types';

export const handleVideoRoutes: RouteHandler = async (context, services) => {
  const { provider } = services;

  if (context.method === 'POST' && context.path === 'video/assets/upload') {
    const body = await readRequestBody(context);
    const uploaded = await provider.uploadVideoAsset({
      user_id: asString(body.user_id),
      match_id: asString(body.match_id),
      file_name: asString(body.file_name),
      mime_type: asString(body.mime_type),
      size_bytes: Number(body.size_bytes ?? 0),
      duration_seconds: Number(body.duration_seconds ?? 0),
      nowIso: asString(body.nowIso ?? body.now_iso, new Date().toISOString()),
    });
    writeJson(context.res, 200, uploaded);
    return true;
  }

  if (context.method === 'GET' && context.path.startsWith('video/assets/')) {
    const assetId = decodeURIComponent(context.path.slice('video/assets/'.length));
    const asset = await provider.getVideoAsset(assetId);
    writeJson(context.res, 200, asset ?? null);
    return true;
  }

  if (context.method === 'POST' && context.path === 'video/tasks/create') {
    const body = await readRequestBody(context);
    const region = asString((body as Record<string, unknown>).region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN';
    const match =
      (body.match as never) ??
      (await provider.getMatchDetail(region, asString(body.match_id)));
    if (!match) {
      writeJson(context.res, 400, { ok: false, error: 'match not found' });
      return true;
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
    writeJson(context.res, 200, created);
    return true;
  }

  if (context.method === 'POST' && context.path === 'video/tasks/run') {
    const body = await readRequestBody(context);
    await provider.runVideoDiagnosisTask(asString(body.task_id), {
      nowIso: asString(body.now_iso, new Date().toISOString()),
      match: body.match as never,
      deepReview: body.deep_review as never,
    });
    writeJson(context.res, 200, { ok: true });
    return true;
  }

  if (context.method === 'POST' && context.path === 'video/tasks/run-from-queue') {
    const body = await readRequestBody(context);
    const region = asString(body.region, 'INTERNATIONAL') as 'INTERNATIONAL' | 'CN';
    const match = await provider.getMatchDetail(region, asString(body.match_id));
    if (!match) {
      writeJson(context.res, 400, { ok: false, error: 'match not found' });
      return true;
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
    writeJson(context.res, 200, { ok: true });
    return true;
  }

  if (context.method === 'GET' && context.path.startsWith('video/tasks/')) {
    const taskId = decodeURIComponent(context.path.slice('video/tasks/'.length));
    const task = await provider.getVideoDiagnosisTask(taskId);
    writeJson(context.res, 200, task ?? null);
    return true;
  }

  if (context.method === 'GET' && context.path === 'video/tasks/latest') {
    const task = await provider.getLatestVideoDiagnosisTask(
      asString(context.url.searchParams.get('user_id')),
      asString(context.url.searchParams.get('match_id'))
    );
    writeJson(context.res, 200, task ?? null);
    return true;
  }

  if (context.method === 'GET' && context.path.startsWith('video/results/by-task/')) {
    const taskId = decodeURIComponent(context.path.slice('video/results/by-task/'.length));
    const result = await provider.getVideoDiagnosisResultByTask(taskId);
    writeJson(context.res, 200, result ?? null);
    return true;
  }

  if (context.method === 'GET' && context.path === 'video/results/latest') {
    const result = await provider.getLatestVideoDiagnosisResult(
      asString(context.url.searchParams.get('user_id')),
      asString(context.url.searchParams.get('match_id'))
    );
    writeJson(context.res, 200, result ?? null);
    return true;
  }

  return false;
};

