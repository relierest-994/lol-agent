import type { DeepReviewResult } from '../../domain';
import type { TaskObservation } from '../app-shell/use-agent-shell';

interface DeepReviewSectionRendererProps {
  deepReview?: DeepReviewResult;
  running: boolean;
  taskObservation?: TaskObservation;
}

export function DeepReviewSectionRenderer({ deepReview, running, taskObservation }: DeepReviewSectionRendererProps) {
  const statusLabel: Record<string, string> = {
    PENDING: '排队中',
    RUNNING: '执行中',
    COMPLETED: '已完成',
    FAILED: '失败',
    NOT_FOUND: '未找到',
  };

  const taskMessage =
    taskObservation?.task_type === 'DEEP_REVIEW'
      ? `[${statusLabel[taskObservation.status] ?? taskObservation.status}] ${taskObservation.message}`
      : undefined;

  return (
    <section className="panel">
      <h2>完整复盘（含深度分析）</h2>
      {running && <p className="muted">正在生成完整复盘...</p>}
      {taskMessage && <p className={taskObservation?.status === 'FAILED' ? 'error' : 'muted'}>{taskMessage}</p>}
      {!running && !deepReview && <p className="muted">暂无深度分析结果。</p>}
      {deepReview && (
        <>
          <p className="muted">{deepReview.render_payload.summary}</p>
          <div className="report-grid">
            {deepReview.render_payload.sections.map((section) => (
              <article key={`${section.section_title}-${section.related_timestamp ?? 'none'}`} className="report-card">
                <h3>{section.section_title}</h3>
                <p>
                  <strong>风险等级：</strong>
                  {section.severity}
                </p>
                <p>{section.insight}</p>
                <ul>
                  {section.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>
                  <strong>建议：</strong>
                  {section.advice}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
