import type { AgentPlan } from '../../agent/planner/agent-planner';
import type { ToolCallSummary } from '../../agent/executor/agent-executor';
import type { AgentStepRecord } from '../../domain';

type UseCaseResult = {
  plan: AgentPlan;
  steps: AgentStepRecord[];
  toolCalls: ToolCallSummary[];
  error?: string;
} | undefined;

interface ExecutionPanelProps {
  result: UseCaseResult;
}

export function ExecutionPanel({ result }: ExecutionPanelProps) {
  if (!result) {
    return (
      <section className="panel">
        <h2>Execution Panel</h2>
        <p className="muted">等待 Agent 执行...</p>
      </section>
    );
  }

  const running = result.steps.filter((step) => step.status === 'RUNNING');
  const done = result.steps.filter((step) => step.status === 'DONE');
  const failed = result.steps.filter((step) => step.status === 'FAILED');

  return (
    <section className="panel">
      <h2>Execution Panel</h2>
      <div className="execution-grid">
        <article>
          <h3>当前计划</h3>
          <p>{result.plan.summary}</p>
          <ul>
            {result.plan.steps.map((step) => (
              <li key={step.stepId}>{step.stepId} - {step.title}</li>
            ))}
          </ul>
        </article>

        <article>
          <h3>执行步骤</h3>
          {running.length > 0 && (
            <>
              <strong>进行中</strong>
              <ul>
                {running.map((step) => (
                  <li key={step.stepId}>{step.stepId} {step.title}</li>
                ))}
              </ul>
            </>
          )}
          <strong>已完成</strong>
          <ul>
            {done.map((step) => (
              <li key={step.stepId}>{step.stepId} {step.summary}</li>
            ))}
          </ul>
          {failed.length > 0 && (
            <>
              <strong>失败</strong>
              <ul>
                {failed.map((step) => (
                  <li key={step.stepId}>{step.stepId} {step.summary}</li>
                ))}
              </ul>
            </>
          )}
          {result.error && <p className="error">{result.error}</p>}
        </article>

        <article>
          <h3>工具调用结果</h3>
          <ul>
            {result.toolCalls.map((tool) => (
              <li key={`${tool.capability}-${tool.summary}`}>
                {tool.capability}: {tool.summary}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
