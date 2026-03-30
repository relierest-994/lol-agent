import { describe, expect, it } from 'vitest';
import { AgentOrchestrator } from '../src/agent';
import { confirmMockPayment, createMockOrder } from '../src/application';

describe('AgentOrchestrator Phase2 Flow', () => {
  it('runs basic review flow', async () => {
    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId: 'u-basic-1',
      region: 'INTERNATIONAL',
      userInput: '帮我复盘最近一把LOL对局',
    });

    expect(result.error).toBeUndefined();
    expect(result.report).toBeDefined();
    expect(result.deepReview).toBeUndefined();
    expect(result.renderPayload.state).toBe('SUCCESS');
  });

  it('runs deep review when entitlement is available', async () => {
    const userId = 'u-deep-1';
    const created = await createMockOrder({ userId, planCode: 'PRO_MONTHLY', featureCode: 'DEEP_REVIEW' });
    if (!created.ok) return;
    await confirmMockPayment({ orderId: created.order.id, transactionId: 'txn-orch-deep' });

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId,
      region: 'CN',
      userInput: '给我做一个深度复盘',
    });

    expect(result.error).toBeUndefined();
    expect(result.deepReview).toBeDefined();
    expect(result.renderPayload.state).toBe('SUCCESS');
  });

  it('returns paywall for deep review without entitlement', async () => {
    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId: 'u-deep-lock-1',
      region: 'INTERNATIONAL',
      userInput: '我要深度复盘这局',
    });

    expect(result.deepReview).toBeUndefined();
    expect(result.renderPayload.state).toBe('PAYWALL');
  });

  it('answers follow-up directly when basic context is enough', async () => {
    const userId = 'u-ask-basic';
    const created = await createMockOrder({ userId, planCode: 'FOLLOWUP_PACK_5', featureCode: 'AI_FOLLOWUP' });
    if (!created.ok) return;
    await confirmMockPayment({ orderId: created.order.id, transactionId: 'txn-ask-basic' });

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId,
      region: 'INTERNATIONAL',
      userInput: '这局我最该先改哪一点？',
    });

    expect(result.error).toBeUndefined();
    expect(result.followupAnswer).toBeDefined();
    expect(result.renderPayload.state).toBe('SUCCESS');
  });

  it('runs clip diagnosis task chain with uploaded clip when entitlement is available', async () => {
    const userId = 'u-clip-1';
    const created = await createMockOrder({ userId, planCode: 'CLIP_PACK_3', featureCode: 'CLIP_REVIEW' });
    if (!created.ok) return;
    await confirmMockPayment({ orderId: created.order.id, transactionId: 'txn-clip-1' });

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      userId,
      region: 'INTERNATIONAL',
      userInput: '帮我看这波为什么打不过',
      uploadedClip: {
        file_name: 'fight.mp4',
        mime_type: 'video/mp4',
        size_bytes: 8 * 1024 * 1024,
        duration_seconds: 20,
      },
    });

    expect(result.error).toBeUndefined();
    if (result.renderPayload.state === 'SUCCESS') {
      expect(result.videoDiagnosis).toBeDefined();
      expect(result.videoDiagnosis?.disclaimers.length).toBeGreaterThan(0);
      return;
    }
    expect(result.renderPayload.state).toBe('PENDING');
    expect(result.videoDiagnosis).toBeUndefined();
  });
});

