import type { AgentPlan } from '../../agent/planner/agent-planner';
import type { ToolCallSummary } from '../../agent/executor/agent-executor';
import type { AgentStepRecord } from '../../domain';

type UseCaseResult = {
  plan: AgentPlan;
  steps: AgentStepRecord[];
  toolCalls: ToolCallSummary[];
  error?: string;
  errorCode?: string;
  renderPayload?: {
    state: string;
    display_message: string;
  };
} | undefined;

interface AgentTaskStatusPanelProps {
  result: UseCaseResult;
}

export function AgentTaskStatusPanel({ result }: AgentTaskStatusPanelProps) {
  if (!result) {
    return (
      <section className="panel">
        <h2>Agent Task Status</h2>
        <p className="muted">Waiting for agent plan...</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Agent Task Status</h2>
      <div className="execution-grid">
        <article>
          <h3>Plan</h3>
          <p>{result.plan.summary}</p>
          <ul>
            {result.plan.steps.map((step) => (
              <li key={step.stepId}>
                {step.stepId} - {step.title}
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Step States</h3>
          <ul>
            {result.steps.map((step) => (
              <li key={step.stepId}>
                {step.stepId} [{step.status}] {step.summary ?? step.title}
              </li>
            ))}
          </ul>
          {result.error && <p className="error">{result.error}</p>}
          {result.errorCode && <p className="muted">Error code: {result.errorCode}</p>}
          {result.renderPayload && (
            <p className={result.renderPayload.state === 'ERROR' ? 'error' : 'muted'}>
              Render state: {result.renderPayload.state} - {result.renderPayload.display_message}
            </p>
          )}
        </article>
        <article>
          <h3>Capability Calls</h3>
          <ul>
            {result.toolCalls.map((call) => (
              <li key={`${call.capability}-${call.summary}`}>
                {call.capability}: {call.summary}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
