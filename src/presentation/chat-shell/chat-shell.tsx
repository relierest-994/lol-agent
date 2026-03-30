import type { ChangeEvent } from 'react';
import type { ChatMessage, ClipDraft } from '../app-shell/use-agent-shell';

interface ChatShellProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  running: boolean;
  accountLinked: boolean;
  messages: ChatMessage[];
  quickPrompts: string[];
  onUsePrompt: (prompt: string) => void;
  attachment?: ClipDraft;
  onAttachmentChange: (attachment?: ClipDraft) => void;
}

export function ChatShell({
  value,
  onChange,
  onSubmit,
  running,
  accountLinked,
  messages,
  quickPrompts,
  onUsePrompt,
  attachment,
  onAttachmentChange,
}: ChatShellProps) {
  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      onAttachmentChange(undefined);
      return;
    }
    onAttachmentChange({
      file_name: file.name,
      mime_type: file.type || inferMimeType(file.name),
      size_bytes: file.size,
      duration_seconds: file.type.startsWith('image/') ? 5 : 20,
    });
  }

  return (
    <section className="panel">
      <h2>AI 追问与素材诊断</h2>
      <div className="quick-prompts">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" className="ghost-btn" onClick={() => onUsePrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <div className="message-list">
        {messages.length === 0 && <p className="muted">先生成完整复盘，再在这里继续追问。</p>}
        {messages.map((message) => (
          <div key={message.id} className={`message-row ${message.role}`}>
            <div className="message-role">{message.role === 'user' ? '你' : 'Agent'}</div>
            <div className="message-content">{message.content}</div>
          </div>
        ))}
      </div>

      <div className="chat-box">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={accountLinked ? '输入追问，或上传素材后提问...' : '请先完成账号绑定'}
          disabled={!accountLinked}
        />
        <div className="control-row">
          <label className="ghost-btn">
            上传素材
            <input type="file" accept="video/*,image/*" onChange={onPickFile} style={{ display: 'none' }} />
          </label>
          {attachment && (
            <>
              <span className="muted">已附带：{attachment.file_name}</span>
              <button type="button" className="ghost-btn" onClick={() => onAttachmentChange(undefined)}>
                移除素材
              </button>
            </>
          )}
        </div>
        <p className="muted">素材限制：支持图片/视频；视频建议 10-30 秒，最长 60 秒，文件最大 50MB。</p>
        <button disabled={running || !accountLinked} onClick={onSubmit}>
          {running ? '正在分析中...' : '发送请求'}
        </button>
      </div>
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
