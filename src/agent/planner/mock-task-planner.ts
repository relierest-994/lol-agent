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
      { stepId: 'S6', title: '生成基础复盘', action: 'review.generate_basic', requiresEntitlement: 'BASIC_REVIEW' },
      { stepId: 'S7', title: '生成结构化深度分析', action: 'review.deep.generate' },
      { stepId: 'S8', title: '读取深度分析结果', action: 'review.deep.get' },
    ];
  }

  if (goal.intent === 'AI_FOLLOWUP') {
    if (followupNeedsDeep(goal.rawInput)) {
      return [
        { stepId: 'S6', title: '检查深度复盘状态', action: 'review.deep.status' },
        { stepId: 'S7', title: '按需生成深度复盘', action: 'review.deep.generate' },
        { stepId: 'S8', title: '结合上下文进行追问回答', action: 'review.ask.match', requiresEntitlement: 'AI_FOLLOWUP' },
      ];
    }

    return [{ stepId: 'S6', title: '直接回答追问', action: 'review.ask.match', requiresEntitlement: 'AI_FOLLOWUP' }];
  }

  if (goal.intent === 'CLIP_REVIEW') {
    return [
      { stepId: 'S6', title: '上传视频片段素材', action: 'asset.video.upload' },
      { stepId: 'S7', title: '创建视频诊断任务', action: 'diagnosis.video.create', requiresEntitlement: 'CLIP_REVIEW' },
      { stepId: 'S8', title: '检查视频诊断状态', action: 'diagnosis.video.status', requiresEntitlement: 'CLIP_REVIEW' },
      { stepId: 'S9', title: '读取视频诊断结果', action: 'diagnosis.video.get', requiresEntitlement: 'CLIP_REVIEW' },
    ];
  }

  if (goal.intent === 'ENTITLEMENT_VIEW') {
    return [
      { stepId: 'S6', title: '解释深度复盘权益状态', action: 'entitlement.explain' },
    ];
  }

  return [
    { stepId: 'S6', title: '生成基础复盘', action: 'review.generate_basic', requiresEntitlement: 'BASIC_REVIEW' },
    { stepId: 'S7', title: '生成结构化深度分析', action: 'review.deep.generate' },
    { stepId: 'S8', title: '读取深度分析结果', action: 'review.deep.get' },
  ];
}

export class MockTaskPlanner implements TaskPlanner {
  plan(goal: UserGoal): AgentPlan {
    const createdAt = new Date().toISOString();

    if (goal.intent === 'UNKNOWN') {
      return {
        planId: `plan-${Date.now()}`,
        createdAt,
        goal,
        summary: '无法识别复盘目标，返回澄清指引。',
        steps: [],
      };
    }

    const core: PlanStep[] = [
      { stepId: 'S1', title: '解析大区上下文', action: 'region.select' },
      { stepId: 'S2', title: '检查账号绑定状态', action: 'account.link_status' },
      { stepId: 'S3', title: '必要时执行账号绑定', action: 'account.link_mock' },
      { stepId: 'S4', title: '拉取最近对局', action: 'match.list_recent' },
      { stepId: 'S5', title: '选择目标对局', action: 'match.select_target' },
    ];

    const capabilitySteps = reviewSteps(goal);
    const finalStepId = `S${5 + capabilitySteps.length + 1}`;

    return {
      planId: `plan-${Date.now()}`,
      createdAt,
      goal,
      summary: '执行主链路：上下文解析、账号、对局、能力调用、结果汇总。',
      steps: [...core, ...capabilitySteps, { stepId: finalStepId, title: '汇总最终响应', action: 'internal.summarize' }],
    };
  }
}


