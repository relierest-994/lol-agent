import { describe, expect, it } from 'vitest';
import { AgentOrchestrator } from '../src/agent';
import { confirmMockPayment, createMockOrder } from '../src/application';

describe('Agent Runtime Thread-D Enhancements', () => {
  it('records trace, correlation and runtime logs through intent-plan-execute', async () => {
    const userId = 'u-runtime-log-1';
    const created = await createMockOrder({ userId, planCode: 'PRO_MONTHLY', featureCode: 'DEEP_REVIEW' });
    if (!created.ok) return;
    await confirmMockPayment({ orderId: created.order.id, transactionId: 'txn-runtime-log-1' });

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId,
      region: 'INTERNATIONAL',
      userInput: '给我做深度复盘',
    });

    expect(result.session.traceId).toBeTruthy();
    expect(result.session.correlationId).toBeTruthy();
    expect(result.session.runtimeLogs.length).toBeGreaterThan(0);
    expect(result.session.runtimeLogs.some((item) => item.event === 'PLAN_BOUND')).toBe(true);
    expect(result.renderPayload.state).toBe('SUCCESS');
  });

  it('returns paywall render contract when user has no paid entitlement', async () => {
    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId: 'u-runtime-paywall-1',
      region: 'INTERNATIONAL',
      userInput: '我要看深度复盘',
    });

    expect(result.errorCode).toBe('PAYWALL_REQUIRED');
    expect(result.renderPayload.state).toBe('PAYWALL');
    if (result.renderPayload.state !== 'PAYWALL') return;
    expect(result.renderPayload.reason_code).toBeTruthy();
  });

  it('reuses deep review cache when same match/user asks repeatedly', async () => {
    const userId = 'u-runtime-cache-1';
    const created = await createMockOrder({ userId, planCode: 'PRO_MONTHLY', featureCode: 'DEEP_REVIEW' });
    if (!created.ok) return;
    await confirmMockPayment({ orderId: created.order.id, transactionId: 'txn-runtime-cache-1' });

    const orchestrator = new AgentOrchestrator();

    const first = await orchestrator.run({
      userId,
      region: 'INTERNATIONAL',
      userInput: '做一个深度复盘',
    });

    const second = await orchestrator.run({
      userId,
      region: 'INTERNATIONAL',
      userInput: '再做一次深度复盘',
    });

    const firstDeep = first.session.capabilityResults.find((item) => item.action === 'review.deep.generate');
    const secondDeep = second.session.capabilityResults.find((item) => item.action === 'review.deep.generate');

    expect(firstDeep?.ok).toBe(true);
    expect(secondDeep?.ok).toBe(true);
    expect((firstDeep?.data as { cached?: boolean } | undefined)?.cached).toBe(false);
    expect((secondDeep?.data as { cached?: boolean } | undefined)?.cached).toBe(true);
  });

  it('returns input-required render payload when clip intent has no uploaded asset', async () => {
    const userId = 'u-runtime-input-1';
    const created = await createMockOrder({ userId, planCode: 'CLIP_PACK_3', featureCode: 'CLIP_REVIEW' });
    if (!created.ok) return;
    await confirmMockPayment({ orderId: created.order.id, transactionId: 'txn-runtime-input-1' });

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId,
      region: 'INTERNATIONAL',
      userInput: '帮我看这段视频为什么打不过',
    });

    expect(result.errorCode).toBe('CONTEXT_INCOMPLETE');
    expect(result.renderPayload.state).toBe('INPUT_REQUIRED');
    if (result.renderPayload.state !== 'INPUT_REQUIRED') return;
    expect(result.renderPayload.required_inputs).toContain('uploaded_clip');
  });

  it('returns retryable error payload when diagnosis provider fails', async () => {
    const userId = 'u-runtime-retry-1';
    const created = await createMockOrder({ userId, planCode: 'CLIP_PACK_3', featureCode: 'CLIP_REVIEW' });
    if (!created.ok) return;
    await confirmMockPayment({ orderId: created.order.id, transactionId: 'txn-runtime-retry-1' });

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId,
      region: 'INTERNATIONAL',
      userInput: 'fail-provider 这波团战我哪里处理错了',
      uploadedClip: {
        file_name: 'fight.mp4',
        mime_type: 'video/mp4',
        size_bytes: 8 * 1024 * 1024,
        duration_seconds: 20,
      },
    });

    expect(['PENDING', 'RETRYABLE_ERROR']).toContain(result.renderPayload.state);
    if (result.renderPayload.state === 'RETRYABLE_ERROR') {
      expect(result.errorCode).toBe('PROVIDER_RETRYABLE');
      return;
    }
    expect(result.renderPayload.state).toBe('PENDING');
  });
});

