import type { ChangeEvent } from 'react';
import type { ClipDraft, TaskObservation } from '../app-shell/use-agent-shell';

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
  const statusLabel: Record<string, string> = {
    PENDING: '排队中',
    RUNNING: '执行中',
    COMPLETED: '已完成',
    FAILED: '失败',
    NOT_FOUND: '未找到',
  };

  const taskMessage =
    taskObservation?.task_type === 'VIDEO_DIAGNOSIS'
      ? `${statusLabel[taskObservation.status] ?? taskObservation.status}：${taskObservation.message}`
      : undefined;

  function applyFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onChange({
      file_name: file.name,
      mime_type: file.type || inferMimeType(file.name),
      size_bytes: file.size,
      duration_seconds: file.type.startsWith('image/') ? 5 : 20,
    });
  }

  return (
    <section className="panel">
      <h2>多模态素材诊断</h2>
      <div className="report-grid">
        <label>
          选择文件
          <input type="file" accept="video/*,image/*" onChange={applyFile} />
        </label>
        <label>
          文件名
          <input value={draft.file_name} onChange={(event) => onChange({ ...draft, file_name: event.target.value })} />
        </label>
        <label>
          格式
          <input value={draft.mime_type} onChange={(event) => onChange({ ...draft, mime_type: event.target.value })} />
        </label>
        <label>
          大小（MB）
          <input
            type="number"
            min={1}
            value={Math.max(1, Math.round(draft.size_bytes / (1024 * 1024)))}
            onChange={(event) =>
              onChange({
                ...draft,
                size_bytes: Math.max(1, Number(event.target.value || 1)) * 1024 * 1024,
              })
            }
          />
        </label>
        <label>
          时长（秒）
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
        placeholder="例如：请诊断这波团战我为什么会先倒。"
      />

      <div className="control-row">
        <button type="button" disabled={running} onClick={onDiagnose}>
          {running ? '诊断任务执行中...' : '开始素材诊断'}
        </button>
      </div>

      <p className="muted">支持视频/图片；建议 10-30 秒片段，最大 50MB。</p>
      {lockedInfo && <p className="locked">{lockedInfo}</p>}
      {taskMessage && <p className={taskObservation?.status === 'FAILED' ? 'error' : 'muted'}>{taskMessage}</p>}
    </section>
  );
}

function inferMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}
