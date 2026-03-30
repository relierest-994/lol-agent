import type { ClipDraft } from '../app-shell/use-agent-shell';
import type { TaskObservation } from '../app-shell/use-agent-shell';

interface VideoUploadPanelProps {
  draft: ClipDraft;
  onChange: (next: ClipDraft) => void;
  question: string;
  onQuestionChange: (question: string) => void;
  onDiagnose: () => void;
  running: boolean;
  lockedInfo?: string;
  taskObservation?: TaskObservation;
}

export function VideoUploadPanel({
  draft,
  onChange,
  question,
  onQuestionChange,
  onDiagnose,
  running,
  lockedInfo,
  taskObservation,
}: VideoUploadPanelProps) {
  const taskMessage =
    taskObservation?.task_type === 'VIDEO_DIAGNOSIS' ? `${taskObservation.status}: ${taskObservation.message}` : undefined;
  return (
    <section className="panel">
      <h2>Video Upload Panel</h2>
      <div className="report-grid">
        <label>
          File Name
          <input
            value={draft.file_name}
            onChange={(event) => onChange({ ...draft, file_name: event.target.value })}
          />
        </label>
        <label>
          Mime Type
          <select
            value={draft.mime_type}
            onChange={(event) => onChange({ ...draft, mime_type: event.target.value })}
          >
            <option value="video/mp4">video/mp4</option>
            <option value="video/quicktime">video/quicktime</option>
            <option value="video/webm">video/webm</option>
          </select>
        </label>
        <label>
          Size (MB)
          <input
            type="number"
            min={1}
            value={Math.round(draft.size_bytes / (1024 * 1024))}
            onChange={(event) =>
              onChange({
                ...draft,
                size_bytes: Math.max(1, Number(event.target.value || 1)) * 1024 * 1024,
              })
            }
          />
        </label>
        <label>
          Duration (sec)
          <input
            type="number"
            min={1}
            value={draft.duration_seconds}
            onChange={(event) => onChange({ ...draft, duration_seconds: Math.max(1, Number(event.target.value || 1)) })}
          />
        </label>
      </div>
      <textarea
        rows={2}
        value={question}
        onChange={(event) => onQuestionChange(event.target.value)}
        placeholder="Describe what you want diagnosed in this clip..."
      />
      <div className="control-row">
        <button type="button" disabled={running} onClick={onDiagnose}>
          {running ? 'Running diagnosis task...' : 'Run Clip Diagnosis'}
        </button>
      </div>
      <p className="muted">
        Limits: max 60s, recommended 10-30s, max 50MB, one clip per diagnosis.
      </p>
      {lockedInfo && <p className="locked">{lockedInfo}</p>}
      {taskMessage && <p className="muted">{taskMessage}</p>}
    </section>
  );
}
