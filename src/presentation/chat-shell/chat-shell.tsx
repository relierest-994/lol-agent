import type { ChatMessage } from '../app-shell/use-agent-shell';

interface ChatShellProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  running: boolean;
  messages: ChatMessage[];
  quickPrompts: string[];
  onUsePrompt: (prompt: string) => void;
}

export function ChatShell({
  value,
  onChange,
  onSubmit,
  running,
  messages,
  quickPrompts,
  onUsePrompt,
}: ChatShellProps) {
  return (
    <section className="panel">
      <h2>Agent Chat Shell</h2>
      <div className="quick-prompts">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" className="ghost-btn" onClick={() => onUsePrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <div className="message-list">
        {messages.length === 0 && <p className="muted">开始输入目标，Agent 会返回计划与执行状态。</p>}
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
          placeholder="输入你的复盘目标..."
        />
        <button disabled={running} onClick={onSubmit}>
          {running ? 'Agent 执行中...' : '发送给 Agent'}
        </button>
      </div>
    </section>
  );
}
