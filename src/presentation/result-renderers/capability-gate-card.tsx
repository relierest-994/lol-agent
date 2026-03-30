interface CapabilityGateCardProps {
  title: string;
  description: string;
  unlocked: boolean;
  remainingQuota?: number;
}

export function CapabilityGateCard({
  title,
  description,
  unlocked,
  remainingQuota,
}: CapabilityGateCardProps) {
  return (
    <article className="gate-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="gate-lock">{unlocked ? 'Unlocked' : 'Locked'}</span>
      <div className="muted">
        {typeof remainingQuota === 'number' ? `Remaining quota: ${remainingQuota}` : 'Remaining quota: unlimited / none'}
      </div>
    </article>
  );
}
