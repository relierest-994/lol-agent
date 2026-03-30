import type { EntitlementState } from '../../domain';

interface EntitlementStatusBannerProps {
  entitlement?: EntitlementState;
  loading?: boolean;
  error?: string;
}

export function EntitlementStatusBanner({ entitlement, loading, error }: EntitlementStatusBannerProps) {
  if (loading) {
    return (
      <section className="panel">
        <h2>权益状态</h2>
        <p className="muted">正在加载权益状态...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <h2>权益状态</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!entitlement) return null;

  const paidUnlocked = ['AI_FOLLOWUP', 'CLIP_REVIEW'].filter(
    (feature) => entitlement.features[feature as keyof typeof entitlement.features]
  ).length;

  return (
    <section className="panel">
      <h2>权益状态</h2>
      <p className="muted">已解锁付费能力：{paidUnlocked}/2（仅 AI 追问、视频诊断收费）</p>
      <ul>
        {Object.entries(entitlement.features).map(([feature, available]) => (
          <li key={feature}>
            {feature}: {available ? '可用' : '未解锁'}
          </li>
        ))}
      </ul>
    </section>
  );
}
