import { describe, expect, it } from 'vitest';
import { createMockCapabilityRegistry } from '../src/capabilities/toolkit';
import { clearPersistentState } from '../src/infrastructure/persistence/persistent-state.store';
import { getLocalJobQueueRuntime } from '../src/infrastructure/queue/job-queue.runtime';

function ctx(userId: string, region: 'INTERNATIONAL' | 'CN' = 'INTERNATIONAL') {
  return {
    userId,
    region,
    nowIso: new Date().toISOString(),
    sessionId: `session-${userId}`,
  };
}

describe('Queue task flow', () => {
  it('covers deep review, asset processing and video diagnosis queue tasks', async () => {
    clearPersistentState('job-queue-runtime');
    clearPersistentState('video-diagnosis-repository');
    clearPersistentState('deep-review-repository');
    clearPersistentState('billing-repository');
    const registry = createMockCapabilityRegistry();
    const userId = 'queue-flow-u1';
    const context = ctx(userId);

    const unlock = await registry.invoke({
      id: 'unlock.create',
      context,
      input: { userId, plan_code: 'PRO_MONTHLY', feature_code: 'DEEP_REVIEW' },
    });
    expect(unlock.result.ok).toBe(true);
    if (!unlock.result.ok) return;
    const orderId = (unlock.result.data as { order_id: string }).order_id;
    await registry.invoke({
      id: 'unlock.confirm',
      context,
      input: { order_id: orderId, transaction_id: 'txn-queue-flow' },
    });

    const linked = await registry.invoke({
      id: 'account.link_mock',
      context,
      input: { userId, region: 'INTERNATIONAL' },
    });
    if (!linked.result.ok) return;
    const accountId = (linked.result.data as { account: { accountId: string } }).account.accountId;
    const recent = await registry.invoke({
      id: 'match.list_recent',
      context,
      input: { userId, region: 'INTERNATIONAL', accountId, limit: 1 },
    });
    if (!recent.result.ok) return;
    const matchId = (recent.result.data as { matches: Array<{ matchId: string }> }).matches[0]?.matchId;
    if (!matchId) return;

    const deep = await registry.invoke({
      id: 'review.deep.generate',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        account_id: accountId,
        match_id: matchId,
        authorization_context: { entitlement_checked: true },
      },
    });
    expect(deep.result.ok).toBe(true);

    const upload = await registry.invoke({
      id: 'asset.video.upload',
      context,
      input: {
        user_id: userId,
        match_id: matchId,
        file_name: 'clip.mp4',
        mime_type: 'video/mp4',
        size_bytes: 1024 * 1024,
        duration_seconds: 18,
      },
    });
    expect(upload.result.ok).toBe(true);
    if (!upload.result.ok) return;
    const assetId = (upload.result.data as { asset_id: string }).asset_id;

    const clipUnlock = await registry.invoke({
      id: 'unlock.create',
      context,
      input: { userId, plan_code: 'CLIP_PACK_3', feature_code: 'CLIP_REVIEW' },
    });
    if (!clipUnlock.result.ok) return;
    const clipOrderId = (clipUnlock.result.data as { order_id: string }).order_id;
    await registry.invoke({
      id: 'unlock.confirm',
      context,
      input: { order_id: clipOrderId, transaction_id: 'txn-queue-clip' },
    });

    const createDiag = await registry.invoke({
      id: 'diagnosis.video.create',
      context,
      input: {
        user_id: userId,
        region: 'INTERNATIONAL',
        match_id: matchId,
        asset_id: assetId,
        natural_language_question: 'why lost this fight',
        entitlement_context: { entitlement_checked: true },
      },
    });
    expect(createDiag.result.ok).toBe(true);

    await getLocalJobQueueRuntime().processDueJobs();
    const queue = getLocalJobQueueRuntime();
    expect(queue.listJobsByType('deep_review_generate').length).toBeGreaterThan(0);
    expect(queue.listJobsByType('asset_processing').length).toBeGreaterThan(0);
    expect(queue.listJobsByType('video_diagnosis').length).toBeGreaterThan(0);
  });
});
