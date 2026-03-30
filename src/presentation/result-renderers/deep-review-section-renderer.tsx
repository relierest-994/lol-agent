import type { DeepReviewResult } from '../../domain';
import type { TaskObservation } from '../app-shell/use-agent-shell';

interface DeepReviewSectionRendererProps {
  deepReview?: DeepReviewResult;
  running: boolean;
  taskObservation?: TaskObservation;
}

export function DeepReviewSectionRenderer({ deepReview, running, taskObservation }: DeepReviewSectionRendererProps) {
  const taskMessage =
    taskObservation?.task_type === 'DEEP_REVIEW' ? `[${taskObservation.status}] ${taskObservation.message}` : undefined;
  return (
    <section className="panel">
      <h2>Deep Review</h2>
      {running && <p className="muted">Agent is planning or generating deep review...</p>}
      {taskMessage && <p className={taskObservation?.status === 'FAILED' ? 'error' : 'muted'}>{taskMessage}</p>}
      {!running && !deepReview && <p className="muted">No deep review result yet.</p>}
      {deepReview && (
        <>
          <p className="muted">{deepReview.render_payload.summary}</p>
          <div className="report-grid">
            {deepReview.render_payload.sections.map((section) => (
              <article key={`${section.section_title}-${section.related_timestamp ?? 'none'}`} className="report-card">
                <h3>{section.section_title}</h3>
                <p><strong>Severity:</strong> {section.severity}</p>
                <p>{section.insight}</p>
                <ul>
                  {section.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p><strong>Advice:</strong> {section.advice}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
