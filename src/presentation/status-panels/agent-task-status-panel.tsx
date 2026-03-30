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
  const stepStatusLabel: Record<string, string> = {
    PENDING: '待执行',
    RUNNING: '执行中',
    DONE: '完成',
    FAILED: '失败',
    SKIPPED: '跳过',
  };
  const renderStateLabel: Record<string, string> = {
    SUCCESS: '成功',
    PAYWALL: '需要解锁',
    PENDING: '处理中',
    RETRYABLE_ERROR: '可重试错误',
    INPUT_REQUIRED: '需要补充输入',
    ERROR: '错误',
  };

  if (!result) {
    return (
      <section className="panel">
        <h2>任务状态</h2>
        <p className="muted">等待任务规划...</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>任务状态</h2>
      <div className="execution-grid">
        <article>
          <h3>执行计划</h3>
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
          <h3>步骤状态</h3>
          <ul>
            {result.steps.map((step) => (
              <li key={step.stepId}>
                {step.stepId} [{stepStatusLabel[step.status] ?? step.status}] {step.summary ?? step.title}
              </li>
            ))}
          </ul>
          {result.error && <p className="error">{result.error}</p>}
          {result.errorCode && <p className="muted">错误码：{result.errorCode}</p>}
          {result.renderPayload && (
            <p className={result.renderPayload.state === 'ERROR' ? 'error' : 'muted'}>
              渲染状态：{renderStateLabel[result.renderPayload.state] ?? result.renderPayload.state} - {result.renderPayload.display_message}
            </p>
          )}
        </article>
        <article>
          <h3>能力调用</h3>
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
