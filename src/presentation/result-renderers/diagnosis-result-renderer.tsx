import type { VideoDiagnosisResult } from '../../domain';
import type { TaskObservation } from '../app-shell/use-agent-shell';

interface DiagnosisResultRendererProps {
  result?: VideoDiagnosisResult;
  running: boolean;
  error?: string;
  taskObservation?: TaskObservation;
}

export function DiagnosisResultRenderer({ result, running, error, taskObservation }: DiagnosisResultRendererProps) {
  const statusLabel: Record<string, string> = {
    PENDING: '排队中',
    RUNNING: '执行中',
    COMPLETED: '已完成',
    FAILED: '失败',
    NOT_FOUND: '未找到',
  };
  const taskMessage =
    taskObservation?.task_type === 'VIDEO_DIAGNOSIS'
      ? `[${statusLabel[taskObservation.status] ?? taskObservation.status}] ${taskObservation.message}`
      : undefined;
  return (
    <section className="panel">
      <h2>诊断结果</h2>
      {running && <p className="muted">任务已创建，等待诊断结果...</p>}
      {taskMessage && <p className={taskObservation?.status === 'FAILED' ? 'error' : 'muted'}>{taskMessage}</p>}
      {error && <p className="error">{error}</p>}
      {!running && !result && !error && <p className="muted">暂无诊断结果。</p>}
      {result && (
        <>
          <p>{result.diagnosis_summary}</p>
          <div className="report-grid">
            {result.render_payload.cards.map((card) => (
              <article key={`${card.section_title}-${card.related_timestamp ?? 'none'}`} className="report-card">
                <h3>{card.section_title}</h3>
                <p><strong>风险等级：</strong>{card.severity}</p>
                <p>{card.insight}</p>
                <ul>
                  {card.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>{card.advice}</p>
              </article>
            ))}
          </div>
          <ul>
            {result.disclaimers.map((d) => (
              <li key={d} className="muted">{d}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
