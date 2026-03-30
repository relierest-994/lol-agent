import type { AgentPlan, PlanStep, UserGoal } from '../protocol/agent-protocol';

export interface TaskPlanner {
  plan(goal: UserGoal): AgentPlan;
}

function followupNeedsDeep(input: string): boolean {
  return /(对线|中期|节奏|资源|团战|出装|技能|符文|位置|细节|拆解|为什么|复盘深挖)/i.test(input);
}

function reviewSteps(goal: UserGoal): PlanStep[] {
  if (goal.intent === 'DEEP_REVIEW') {
    return [
      { stepId: 'S6', title: 'Check deep review status', action: 'review.deep.status' },
      { stepId: 'S7', title: 'Generate deep review', action: 'review.deep.generate', requiresEntitlement: 'DEEP_REVIEW' },
      { stepId: 'S8', title: 'Get deep review result', action: 'review.deep.get', requiresEntitlement: 'DEEP_REVIEW' },
    ];
  }

  if (goal.intent === 'AI_FOLLOWUP') {
    if (followupNeedsDeep(goal.rawInput)) {
      return [
        { stepId: 'S6', title: 'Check deep review status', action: 'review.deep.status' },
        { stepId: 'S7', title: 'Generate deep review if needed', action: 'review.deep.generate', requiresEntitlement: 'DEEP_REVIEW' },
        { stepId: 'S8', title: 'Ask match follow-up with context', action: 'review.ask.match', requiresEntitlement: 'AI_FOLLOWUP' },
      ];
    }

    return [{ stepId: 'S6', title: 'Ask match follow-up directly', action: 'review.ask.match', requiresEntitlement: 'AI_FOLLOWUP' }];
  }

  if (goal.intent === 'CLIP_REVIEW') {
    return [
      { stepId: 'S6', title: 'Upload short clip asset', action: 'asset.video.upload' },
      { stepId: 'S7', title: 'Create video diagnosis task', action: 'diagnosis.video.create', requiresEntitlement: 'CLIP_REVIEW' },
      { stepId: 'S8', title: 'Check video diagnosis status', action: 'diagnosis.video.status', requiresEntitlement: 'CLIP_REVIEW' },
      { stepId: 'S9', title: 'Get video diagnosis result', action: 'diagnosis.video.get', requiresEntitlement: 'CLIP_REVIEW' },
    ];
  }

  if (goal.intent === 'ENTITLEMENT_VIEW') {
    return [
      { stepId: 'S6', title: 'Explain deep review entitlement', action: 'entitlement.explain' },
    ];
  }

  return [{ stepId: 'S6', title: 'Generate basic review', action: 'review.generate_basic', requiresEntitlement: 'BASIC_REVIEW' }];
}

export class MockTaskPlanner implements TaskPlanner {
  plan(goal: UserGoal): AgentPlan {
    const createdAt = new Date().toISOString();

    if (goal.intent === 'UNKNOWN') {
      return {
        planId: `plan-${Date.now()}`,
        createdAt,
        goal,
        summary: 'Cannot recognize review goal; return clarification guidance.',
        steps: [],
      };
    }

    const core: PlanStep[] = [
      { stepId: 'S1', title: 'Resolve region context', action: 'region.select' },
      { stepId: 'S2', title: 'Check account link status', action: 'account.link_status' },
      { stepId: 'S3', title: 'Link account via mock if needed', action: 'account.link_mock' },
      { stepId: 'S4', title: 'Fetch recent matches', action: 'match.list_recent' },
      { stepId: 'S5', title: 'Select target match', action: 'match.select_target' },
    ];

    const capabilitySteps = reviewSteps(goal);
    const finalStepId = `S${5 + capabilitySteps.length + 1}`;

    return {
      planId: `plan-${Date.now()}`,
      createdAt,
      goal,
      summary: 'Run agent main loop: context, account, match, capability execution, synthesis.',
      steps: [...core, ...capabilitySteps, { stepId: finalStepId, title: 'Synthesize final response', action: 'internal.summarize' }],
    };
  }
}


