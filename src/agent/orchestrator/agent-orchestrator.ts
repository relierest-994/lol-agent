import { createCapabilityRegistry } from '../../capabilities/toolkit';
import type { CapabilityExecutionContext } from '../../capabilities/toolkit';
import type { LinkedAccount, Region } from '../../domain';
import { CapabilityExecutor } from '../executor/agent-executor';
import { MockIntentInterpreter } from '../interpreter/mock-intent-interpreter';
import { MockTaskPlanner } from '../planner/mock-task-planner';
import { SessionContextManager } from '../session/session-context-manager';
import { ResultSynthesizer, type LegacyOrchestratorOutput } from '../synthesizer/result-synthesizer';

export interface OrchestratorInput {
  userId: string;
  region: Region;
  userInput: string;
  linkedAccount?: LinkedAccount;
  uploadedClip?: {
    file_name: string;
    mime_type: string;
    size_bytes: number;
    duration_seconds: number;
  };
}

export type OrchestratorOutput = LegacyOrchestratorOutput;

export class AgentOrchestrator {
  private readonly interpreter = new MockIntentInterpreter();
  private readonly taskPlanner = new MockTaskPlanner();
  private readonly sessionManager = new SessionContextManager();
  private readonly registry = createCapabilityRegistry();
  private readonly executor = new CapabilityExecutor(this.registry, this.sessionManager);
  private readonly synthesizer = new ResultSynthesizer();

  async run(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const session = this.sessionManager.createSession(input.userId, input.region);
    const goal = this.interpreter.interpret(input.userInput);
    this.sessionManager.bindGoal(session, goal);

    const plan = this.taskPlanner.plan(goal);
    this.sessionManager.bindPlan(session, plan);

    if (input.uploadedClip) {
      this.sessionManager.updateAssetContext(session, {
        uploadedClip: input.uploadedClip,
      });
    }

    if (goal.intent === 'UNKNOWN') {
      const message = '暂未识别你的请求，请输入“帮我复盘最近一把 LOL 对局”这类指令。';
      return this.synthesizer.synthesize(plan, {
        session,
        toolCalls: [],
        error: message,
        errorCode: 'UNKNOWN_INTENT',
        renderPayload: {
          state: 'INPUT_REQUIRED',
          display_message: message,
          reason_code: 'UNKNOWN_INTENT',
          required_inputs: ['intent'],
        },
      });
    }

    const context: CapabilityExecutionContext = {
      userId: input.userId,
      region: input.region,
      nowIso: new Date().toISOString(),
      sessionId: session.sessionId,
      traceId: session.traceId,
      correlationId: session.correlationId,
    };

    const execution = await this.executor.executePlan(session, plan, context, input.linkedAccount, input.uploadedClip);
    return this.synthesizer.synthesize(plan, execution);
  }
}


