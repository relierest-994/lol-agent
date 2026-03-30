import type { AgentExecutionOutput, ToolCallSummary } from '../executor/agent-executor';
import type { AgentFinalResponse, AgentPlan } from '../protocol/agent-protocol';

export interface LegacyOrchestratorOutput {
  plan: AgentPlan;
  steps: AgentFinalResponse['session']['stepStates'];
  toolCalls: ToolCallSummary[];
  linkedAccount?: AgentFinalResponse['session']['linkedAccount'];
  report?: AgentFinalResponse['report'];
  deepReview?: AgentFinalResponse['deepReview'];
  followupAnswer?: AgentFinalResponse['followupAnswer'];
  videoDiagnosis?: AgentFinalResponse['videoDiagnosis'];
  lockedInfo?: string;
  error?: string;
  errorCode?: AgentFinalResponse['errorCode'];
  renderPayload: AgentFinalResponse['renderPayload'];
  session: AgentFinalResponse['session'];
  finalResponse: AgentFinalResponse;
}

export class ResultSynthesizer {
  synthesize(plan: AgentPlan, execution: AgentExecutionOutput): LegacyOrchestratorOutput {
    const finalResponse: AgentFinalResponse = {
      session: execution.session,
      plan,
      report: execution.report,
      deepReview: execution.deepReview,
      followupAnswer: execution.followupAnswer,
      videoDiagnosis: execution.videoDiagnosis,
      lockedInfo: execution.lockedInfo,
      error: execution.error,
      errorCode: execution.errorCode,
      renderPayload: execution.renderPayload,
      summary: this.summaryText(execution),
    };

    execution.session.runtimeLogs.push({
      at: new Date().toISOString(),
      level: 'INFO',
      event: 'SUMMARY_SYNTHESIZED',
      message: 'Final response render payload synthesized',
      traceId: execution.session.traceId,
      correlationId: execution.session.correlationId,
      details: {
        render_state: execution.renderPayload.state,
      },
    });

    return {
      plan,
      steps: execution.session.stepStates,
      toolCalls: execution.toolCalls,
      linkedAccount: execution.session.linkedAccount,
      report: execution.report,
      deepReview: execution.deepReview,
      followupAnswer: execution.followupAnswer,
      videoDiagnosis: execution.videoDiagnosis,
      lockedInfo: execution.lockedInfo,
      error: execution.error,
      errorCode: execution.errorCode,
      renderPayload: execution.renderPayload,
      session: execution.session,
      finalResponse,
    };
  }

  private summaryText(execution: AgentExecutionOutput): string {
    if (execution.renderPayload.state === 'PAYWALL') {
      return `Agent execution blocked by entitlement: ${execution.renderPayload.display_message}`;
    }
    if (execution.renderPayload.state === 'PENDING') {
      return `Agent task is pending: ${execution.renderPayload.display_message}`;
    }
    if (execution.renderPayload.state === 'RETRYABLE_ERROR') {
      return `Agent hit retryable provider error: ${execution.renderPayload.display_message}`;
    }
    if (execution.error) return `Agent execution failed: ${execution.error}`;
    if (execution.videoDiagnosis) return 'Agent completed video clip diagnosis with structured findings.';
    if (execution.followupAnswer) return 'Agent completed follow-up answer with match context.';
    if (execution.deepReview) return 'Agent completed deep review and generated structured insights.';
    if (execution.report) return 'Agent completed basic review report.';
    return 'Agent execution completed.';
  }
}

