import type { EntitlementFeature, Region } from '../../domain';
import type {
  AgentEntitlementContext,
  AgentErrorCode,
  AgentPlan,
  AgentRuntimeLog,
  AgentSession,
  AgentAssetContext,
  CapabilityInvocation,
  CapabilityResult,
  EntitlementCheckResult,
  PlanAction,
  PlanStep,
  UserGoal,
} from '../protocol/agent-protocol';

function now(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function invocationId(stepId: string): string {
  return `inv-${stepId}-${Date.now()}`;
}

export class SessionContextManager {
  createSession(userId: string, region: Region): AgentSession {
    const timestamp = now();
    const session: AgentSession = {
      sessionId: randomId('session'),
      traceId: randomId('trace'),
      correlationId: randomId('corr'),
      userId,
      region,
      createdAt: timestamp,
      updatedAt: timestamp,
      stepStates: [],
      invocations: [],
      capabilityResults: [],
      entitlementChecks: [],
      matchContext: {
        target: 'LATEST_MATCH',
      },
      entitlementContext: {
        checkedFeatures: [],
        featureAvailability: {},
        remainingQuota: {},
      },
      assetContext: {},
      runtimeLogs: [],
    };

    this.appendLog(session, {
      level: 'INFO',
      event: 'SESSION_CREATED',
      message: 'Agent session initialized',
    });

    return session;
  }

  bindGoal(session: AgentSession, goal: UserGoal): void {
    session.userGoal = goal;
    session.updatedAt = now();
    this.appendLog(session, {
      level: 'INFO',
      event: 'GOAL_BOUND',
      message: `Goal intent bound: ${goal.intent}`,
      details: {
        user_input: goal.rawInput,
      },
    });
  }

  bindPlan(session: AgentSession, plan: AgentPlan): void {
    session.plan = plan;
    session.stepStates = plan.steps.map((step) => ({
      stepId: step.stepId,
      title: step.title,
      status: 'PENDING',
    }));
    session.updatedAt = now();

    this.appendLog(session, {
      level: 'INFO',
      event: 'PLAN_BOUND',
      message: `Plan bound with ${plan.steps.length} steps`,
      details: {
        plan_id: plan.planId,
      },
    });
  }

  updateMatchContext(
    session: AgentSession,
    patch: Partial<AgentSession['matchContext']>
  ): void {
    session.matchContext = {
      ...session.matchContext,
      ...patch,
    };
    session.updatedAt = now();
  }

  updateEntitlementContext(
    session: AgentSession,
    patch: Partial<AgentEntitlementContext>
  ): void {
    session.entitlementContext = {
      ...session.entitlementContext,
      ...patch,
    };
    session.updatedAt = now();
  }

  updateAssetContext(session: AgentSession, patch: Partial<AgentAssetContext>): void {
    session.assetContext = {
      ...session.assetContext,
      ...patch,
    };
    session.updatedAt = now();
  }

  recordEntitlementCheck(session: AgentSession, check: EntitlementCheckResult): void {
    session.entitlementChecks.push(check);

    if (check.feature) {
      const checked = new Set(session.entitlementContext.checkedFeatures);
      checked.add(check.feature);
      session.entitlementContext.checkedFeatures = [...checked];
      session.entitlementContext.featureAvailability[check.feature] = check.allowed;
      if (typeof check.remainingQuota === 'number') {
        session.entitlementContext.remainingQuota[check.feature] = check.remainingQuota;
      }
      if (!check.allowed) {
        session.entitlementContext.paywallFeature = check.feature;
      }
    }

    session.updatedAt = now();
    this.appendLog(session, {
      level: check.allowed ? 'INFO' : 'WARN',
      event: 'ENTITLEMENT_CHECKED',
      message: check.allowed ? 'Entitlement check passed' : 'Entitlement denied',
      stepId: check.stepId,
      errorCode: check.allowed ? undefined : 'PAYWALL_REQUIRED',
      details: {
        feature: check.feature,
        reason_code: check.reasonCode,
        remaining_quota: check.remainingQuota,
      },
    });
  }

  markStepRunning(session: AgentSession, step: PlanStep): CapabilityInvocation {
    const state = session.stepStates.find((item) => item.stepId === step.stepId);
    if (state) state.status = 'RUNNING';

    const invocation: CapabilityInvocation = {
      invocationId: invocationId(step.stepId),
      stepId: step.stepId,
      action: step.action,
      inputSummary: this.inputSummaryFor(step.action),
      startedAt: now(),
      status: step.action === 'internal.summarize' ? 'SKIPPED' : 'RUNNING',
    };

    session.invocations.push(invocation);
    session.updatedAt = now();

    this.appendLog(session, {
      level: 'INFO',
      event: 'STEP_RUNNING',
      message: `Step is running: ${step.title}`,
      stepId: step.stepId,
      action: step.action,
    });

    if (step.action !== 'internal.summarize') {
      this.appendLog(session, {
        level: 'INFO',
        event: 'CAPABILITY_CALLED',
        message: `Calling capability: ${step.action}`,
        stepId: step.stepId,
        action: step.action,
      });
    }

    return invocation;
  }

  markStepDone(session: AgentSession, stepId: string, summary: string): void {
    const state = session.stepStates.find((item) => item.stepId === stepId);
    if (state) {
      state.status = 'DONE';
      state.summary = summary;
    }
    const invocation = session.invocations.find((item) => item.stepId === stepId);
    if (invocation) {
      invocation.status = invocation.status === 'SKIPPED' ? 'SKIPPED' : 'DONE';
      invocation.endedAt = now();
    }
    session.updatedAt = now();

    this.appendLog(session, {
      level: 'INFO',
      event: 'STEP_DONE',
      message: summary,
      stepId,
      action: invocation?.action,
    });
  }

  markStepFailed(session: AgentSession, stepId: string, summary: string, errorCode?: AgentErrorCode): void {
    const state = session.stepStates.find((item) => item.stepId === stepId);
    if (state) {
      state.status = 'FAILED';
      state.summary = summary;
    }
    const invocation = session.invocations.find((item) => item.stepId === stepId);
    if (invocation) {
      invocation.status = 'FAILED';
      invocation.endedAt = now();
    }
    session.updatedAt = now();

    this.appendLog(session, {
      level: 'ERROR',
      event: 'STEP_FAILED',
      message: summary,
      stepId,
      action: invocation?.action,
      errorCode,
    });
  }

  recordCapabilityResult(session: AgentSession, result: CapabilityResult): void {
    session.capabilityResults.push(result);
    session.updatedAt = now();

    this.appendLog(session, {
      level: result.ok ? 'INFO' : 'ERROR',
      event: 'CAPABILITY_DONE',
      message: result.summary,
      stepId: result.stepId,
      action: result.action,
      errorCode: result.errorCode,
      details: {
        retryable: result.retryable,
      },
    });
  }

  appendLog(
    session: AgentSession,
    log: Omit<AgentRuntimeLog, 'at' | 'traceId' | 'correlationId'>
  ): void {
    session.runtimeLogs.push({
      ...log,
      at: now(),
      traceId: session.traceId,
      correlationId: session.correlationId,
    });
    session.updatedAt = now();
  }

  private inputSummaryFor(action: PlanAction): string {
    if (action === 'region.select') return 'Select region context';
    if (action === 'account.link_status') return 'Check linked account';
    if (action === 'account.link_mock') return 'Link account via mock';
    if (action === 'match.list_recent') return 'Fetch recent matches';
    if (action === 'match.select_target') return 'Select target match';
    if (action === 'asset.video.upload') return 'Upload short video clip asset';
    if (action === 'diagnosis.video.create') return 'Create async video diagnosis task';
    if (action === 'diagnosis.video.status') return 'Check video diagnosis task status';
    if (action === 'diagnosis.video.get') return 'Fetch video diagnosis result';
    if (action === 'review.generate_basic') return 'Generate basic review';
    if (action === 'review.deep.status') return 'Check deep review status';
    if (action === 'review.deep.get') return 'Get deep review cache';
    if (action === 'review.deep.generate') return 'Generate deep review';
    if (action === 'review.ask.match') return 'Ask question in match context';
    if (action === 'review.ask.suggested_prompts') return 'Get follow-up prompt suggestions';
    if (action === 'review.generate_deep') return 'Generate deep review (legacy alias)';
    if (action === 'review.analyze_clip') return 'Analyze clip (legacy alias)';
    if (action === 'review.ask_followup') return 'Ask follow-up (legacy alias)';
    if (action === 'entitlement.check') return 'Check entitlement';
    if (action === 'entitlement.explain') return 'Explain entitlement';
    if (action === 'usage.consume') return 'Consume feature usage';
    if (action === 'unlock.create') return 'Create unlock order';
    if (action === 'unlock.confirm') return 'Confirm unlock order';
    if (action === 'billing.unlock') return 'Billing unlock';
    return 'Internal summarize';
  }

  updateQuota(session: AgentSession, feature: EntitlementFeature, remainingQuota?: number): void {
    if (typeof remainingQuota !== 'number') return;
    session.entitlementContext.remainingQuota[feature] = remainingQuota;
    session.updatedAt = now();
  }
}

