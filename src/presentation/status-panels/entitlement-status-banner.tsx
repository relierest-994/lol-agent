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
        <h2>Entitlement Status</h2>
        <p className="muted">Loading entitlement state...</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="panel">
        <h2>Entitlement Status</h2>
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!entitlement) return null;

  const paidUnlocked = ['DEEP_REVIEW', 'AI_FOLLOWUP', 'CLIP_REVIEW'].filter(
    (feature) => entitlement.features[feature as keyof typeof entitlement.features]
  ).length;

  return (
    <section className="panel">
      <h2>Entitlement Status</h2>
      <p className="muted">
        Paid capabilities unlocked: {paidUnlocked}/3
      </p>
      <ul>
        {Object.entries(entitlement.features).map(([feature, available]) => (
          <li key={feature}>
            {feature}: {available ? 'AVAILABLE' : 'LOCKED'}
          </li>
        ))}
      </ul>
    </section>
  );
}
