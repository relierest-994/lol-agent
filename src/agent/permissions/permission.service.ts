import type { AgentSession, EntitlementCheckResult, PlanStep } from '../protocol/agent-protocol';
import type { CapabilityExecutionContext } from '../../capabilities/toolkit';
import type { CapabilityRegistry } from '../../capabilities/toolkit/registry';

export class PermissionService {
  constructor(private readonly registry: CapabilityRegistry) {}

  async checkStepEntitlement(
    context: CapabilityExecutionContext,
    step: PlanStep,
    session: AgentSession
  ): Promise<EntitlementCheckResult> {
    if (!step.requiresEntitlement) {
      return {
        stepId: step.stepId,
        allowed: true,
        reason: 'free-step',
      };
    }

    const result = await this.registry.invoke({
      id: 'entitlement.check',
      context,
      input: {
        userId: session.userId,
        feature_code: step.requiresEntitlement,
      },
    });

    if (!result.result.ok) {
      return {
        stepId: step.stepId,
        allowed: false,
        feature: step.requiresEntitlement,
        reason: result.result.error.message,
      };
    }

    const data = result.result.data as {
      can_access: boolean;
      reason_code: string;
      display_message: string;
      paywall_payload?: import('../../domain').PaywallPayload;
      remaining_quota?: number;
    };

    return {
      stepId: step.stepId,
      allowed: data.can_access,
      feature: step.requiresEntitlement,
      reason: data.display_message || data.reason_code,
      reasonCode: data.reason_code,
      displayMessage: data.display_message,
      remainingQuota: data.remaining_quota,
      paywallPayload: data.paywall_payload,
    };
  }
}
