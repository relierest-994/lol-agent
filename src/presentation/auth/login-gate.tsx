import { useMemo, useState } from 'react';
import { AppShell } from '../app-shell/app-shell';

interface LoginSession {
  userId: string;
  displayName: string;
}

function buildUserId(rawDisplayName: string, rawUserId: string): string {
  const trimmedId = rawUserId.trim();
  if (trimmedId) return trimmedId;
  const base = rawDisplayName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'lol-user'}-${suffix}`;
}

export function LoginGate() {
  const [displayName, setDisplayName] = useState('');
  const [inputUserId, setInputUserId] = useState('');
  const [session, setSession] = useState<LoginSession>();

  const canLogin = useMemo(() => displayName.trim().length > 0, [displayName]);

  if (session) {
    return <AppShell session={session} onLogout={() => setSession(undefined)} />;
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">LOL AI 复盘</p>
        <h1>登录工作台</h1>
        <p className="muted">先进入账号会话，再进行绑定与复盘流程。</p>

        <label>
          昵称
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例如：上分打野"
          />
        </label>

        <label>
          用户ID（可选）
          <input
            value={inputUserId}
            onChange={(event) => setInputUserId(event.target.value)}
            placeholder="留空将自动生成"
          />
        </label>

        <button
          type="button"
          disabled={!canLogin}
          onClick={() =>
            setSession({
              displayName: displayName.trim(),
              userId: buildUserId(displayName, inputUserId),
            })
          }
        >
          进入复盘工作台
        </button>
      </section>
    </main>
  );
}

