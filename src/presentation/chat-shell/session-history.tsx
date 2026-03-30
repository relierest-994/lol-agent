import type { HistoryItem } from '../app-shell/use-agent-shell';

interface SessionHistoryProps {
  items: HistoryItem[];
  onSelect: (itemId: string) => void;
}

export function SessionHistory({ items, onSelect }: SessionHistoryProps) {
  return (
    <section className="panel">
      <h2>历史会话（简版）</h2>
      {items.length === 0 && <p className="muted">暂无历史记录</p>}
      <ul className="history-list">
        {items.map((item) => (
          <li key={item.id}>
            <button className="history-item" onClick={() => onSelect(item.id)}>
              <strong>{item.prompt}</strong>
              <span>{item.region} · {new Date(item.at).toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
