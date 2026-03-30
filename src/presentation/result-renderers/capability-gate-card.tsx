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
      <span className="gate-lock">{unlocked ? '已解锁' : '未解锁'}</span>
      <div className="muted">
        {typeof remainingQuota === 'number' ? `剩余次数：${remainingQuota}` : '剩余次数：不限 / 不适用'}
      </div>
    </article>
  );
}
