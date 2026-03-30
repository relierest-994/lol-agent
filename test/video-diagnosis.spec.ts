import { describe, expect, it } from 'vitest';
import { createMockCapabilityRegistry } from '../src/capabilities/toolkit';

function ctx(userId: string, region: 'INTERNATIONAL' | 'CN' = 'INTERNATIONAL') {
  return {
    userId,
    region,
    nowIso: new Date().toISOString(),
    sessionId: `session-${userId}`,
  };
}

async function getValidMatchId(registry: ReturnType<typeof createMockCapabilityRegistry>, userId: string): Promise<string | undefined> {
  const context = ctx(userId);
  const link = await registry.invoke({
    id: 'account.link_mock',
    context,
    input: { userId, region: 'INTERNATIONAL' },
  });
  if (!link.result.ok) return undefined;
  const accountId = (link.result.data as { account: { accountId: string } }).account.accountId;
  const recent = await registry.invoke({
    id: 'match.list_recent',
    context,
    input: { userId, region: 'INTERNATIONAL', accountId },
  });
  if (!recent.result.ok) return undefined;
  return (recent.result.data as { matches: Array<{ matchId: string }> }).matches[0]?.matchId;
}

describe('Video Diagnosis Capability Chain', () => {
  it('accepts legal upload and returns READY asset', async () => {
    const registry = createMockCapabilityRegistry();
    const context = ctx('video-u1');
    const matchId = await getValidMatchId(registry, 'video-u1');
    if (!matchId) return;
    const upload = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: 'video-u1',
        match_id: matchId,
        file_name: 'clip.mp4',
        mime_type: 'video/mp4',
        size_bytes: 8 * 1024 * 1024,
        duration_seconds: 18,
      },
    });

    expect(upload.result.ok).toBe(true);
    if (!upload.result.ok) return;
    const data = upload.result.data as { status: string; asset_id: string };
    expect(data.status).toBe('READY');
    expect(data.asset_id).toBeTruthy();
  });

  it('rejects over-limit duration and size', async () => {
    const registry = createMockCapabilityRegistry();
    const context = ctx('video-u2');
    const matchId = await getValidMatchId(registry, 'video-u2');
    if (!matchId) return;

    const tooLong = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: 'video-u2',
        match_id: matchId,
        file_name: 'clip.mp4',
        mime_type: 'video/mp4',
        size_bytes: 8 * 1024 * 1024,
        duration_seconds: 90,
      },
    });
    expect(tooLong.result.ok).toBe(false);

    const tooBig = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: 'video-u2',
        match_id: matchId,
        file_name: 'clip.mp4',
        mime_type: 'video/mp4',
        size_bytes: 100 * 1024 * 1024,
        duration_seconds: 20,
      },
    });
    expect(tooBig.result.ok).toBe(false);
  });

  it('rejects create when asset is not bound to match_id', async () => {
    const registry = createMockCapabilityRegistry();
    const context = ctx('video-u3');

    const unlock = await registry.invoke({
      id: 'unlock.create',
      context,
      input: { userId: 'video-u3', plan_code: 'CLIP_PACK_3', feature_code: 'CLIP_REVIEW' },
    });
    expect(unlock.result.ok).toBe(true);
    if (!unlock.result.ok) return;
    const orderId = (unlock.result.data as { order_id: string }).order_id;
    await registry.invoke({
      id: 'unlock.confirm',
      context,
      input: { order_id: orderId, transaction_id: 'txn-video-bind' },
    });

    const upload = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: 'video-u3',
        match_id: 'INTL-1111',
        file_name: 'clip.webm',
        mime_type: 'video/webm',
        size_bytes: 6 * 1024 * 1024,
        duration_seconds: 20,
      },
    });
    expect(upload.result.ok).toBe(true);
    if (!upload.result.ok) return;
    const assetId = (upload.result.data as { asset_id: string }).asset_id;

    const create = await registry.invoke({
      id: 'diagnosis.video.create',
      context,
      input: {
        user_id: 'video-u3',
        region: 'INTERNATIONAL',
        match_id: 'INTL-9001',
        asset_id: assetId,
        natural_language_question: '帮我看这波为什么打不过',
        entitlement_context: { entitlement_checked: true },
      },
    });
    expect(create.result.ok).toBe(false);
  });

  it('returns paywall when clip entitlement is missing', async () => {
    const registry = createMockCapabilityRegistry();
    const context = ctx('video-u4');
    const matchId = await getValidMatchId(registry, 'video-u4');
    if (!matchId) return;
    const upload = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: 'video-u4',
        match_id: matchId,
        file_name: 'clip.mov',
        mime_type: 'video/quicktime',
        size_bytes: 8 * 1024 * 1024,
        duration_seconds: 20,
      },
    });
    if (!upload.result.ok) return;
    const assetId = (upload.result.data as { asset_id: string }).asset_id;

    const create = await registry.invoke({
      id: 'diagnosis.video.create',
      context,
      input: {
        user_id: 'video-u4',
        region: 'INTERNATIONAL',
        match_id: matchId,
        asset_id: assetId,
        natural_language_question: '这段团战我哪里处理错了',
        entitlement_context: { entitlement_checked: true },
      },
    });
    expect(create.result.ok).toBe(false);
  });

  it('supports mock provider success and failure plus result write-back', async () => {
    const registry = createMockCapabilityRegistry();
    const context = ctx('video-u5');
    const matchId = await getValidMatchId(registry, 'video-u5');
    if (!matchId) return;

    const unlock = await registry.invoke({
      id: 'unlock.create',
      context,
      input: { userId: 'video-u5', plan_code: 'CLIP_PACK_3', feature_code: 'CLIP_REVIEW' },
    });
    if (!unlock.result.ok) return;
    const orderId = (unlock.result.data as { order_id: string }).order_id;
    await registry.invoke({
      id: 'unlock.confirm',
      context,
      input: { order_id: orderId, transaction_id: 'txn-video-success' },
    });

    const upload = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: 'video-u5',
        match_id: matchId,
        file_name: 'clip.mp4',
        mime_type: 'video/mp4',
        size_bytes: 8 * 1024 * 1024,
        duration_seconds: 24,
      },
    });
    if (!upload.result.ok) return;
    const assetId = (upload.result.data as { asset_id: string }).asset_id;

    const create = await registry.invoke({
      id: 'diagnosis.video.create',
      context,
      input: {
        user_id: 'video-u5',
        region: 'INTERNATIONAL',
        match_id: matchId,
        asset_id: assetId,
        natural_language_question: '我是不是不该继续追',
        entitlement_context: { entitlement_checked: true },
      },
    });
    expect(create.result.ok).toBe(true);
    if (!create.result.ok) return;
    const taskId = (create.result.data as { task_id: string }).task_id;

    const status = await registry.invoke({
      id: 'diagnosis.video.status',
      context,
      input: { task_id: taskId },
    });
    expect(status.result.ok).toBe(true);
    if (!status.result.ok) return;
    expect((status.result.data as { status: string }).status).toBe('COMPLETED');

    const result = await registry.invoke({
      id: 'diagnosis.video.get',
      context,
      input: { task_id: taskId },
    });
    expect(result.result.ok).toBe(true);
    if (!result.result.ok) return;
    const data = result.result.data as { diagnosis_summary: string; disclaimers: string[] };
    expect(data.diagnosis_summary).toContain('assistive');
    expect(data.disclaimers.length).toBeGreaterThan(0);

    const uploadFail = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: 'video-u5',
        match_id: matchId,
        file_name: 'clip2.mp4',
        mime_type: 'video/mp4',
        size_bytes: 8 * 1024 * 1024,
        duration_seconds: 21,
      },
    });
    if (!uploadFail.result.ok) return;
    const failAssetId = (uploadFail.result.data as { asset_id: string }).asset_id;
    const failedCreate = await registry.invoke({
      id: 'diagnosis.video.create',
      context,
      input: {
        user_id: 'video-u5',
        region: 'INTERNATIONAL',
        match_id: matchId,
        asset_id: failAssetId,
        natural_language_question: 'fail-provider',
        entitlement_context: { entitlement_checked: true },
      },
    });
    expect(failedCreate.result.ok).toBe(true);
    if (!failedCreate.result.ok) return;
    const failTaskId = (failedCreate.result.data as { task_id: string }).task_id;
    const failStatus = await registry.invoke({
      id: 'diagnosis.video.status',
      context,
      input: { task_id: failTaskId },
    });
    expect(failStatus.result.ok).toBe(true);
    if (!failStatus.result.ok) return;
    expect((failStatus.result.data as { status: string }).status).toBe('FAILED');
  });
});
