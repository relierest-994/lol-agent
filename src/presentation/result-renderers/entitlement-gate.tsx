import type { EntitlementFeature, EntitlementState } from '../../domain';
import { CapabilityGateCard } from './capability-gate-card';

const FEATURE_ORDER: EntitlementFeature[] = ['DEEP_REVIEW', 'AI_FOLLOWUP', 'CLIP_REVIEW'];
const FEATURE_FALLBACK: Record<EntitlementFeature, { title: string; description: string }> = {
  BASIC_REVIEW: { title: 'Basic Match Review', description: 'Free baseline review output' },
  BASIC_GROWTH_SUMMARY: { title: 'Basic Growth Summary', description: 'Free growth summary output' },
  DEEP_REVIEW: { title: 'Deep Review', description: 'Dimension-level diagnosis and coaching suggestions' },
  AI_FOLLOWUP: { title: 'AI Follow-up', description: 'Ask context-bound questions around this match' },
  CLIP_REVIEW: { title: 'Video Clip Diagnosis', description: 'Short clip detail diagnosis for this match context' },
};

interface EntitlementGateProps {
  entitlement?: EntitlementState;
}

export function EntitlementGate({ entitlement }: EntitlementGateProps) {
  const gates = entitlement?.featureGates ?? [];

  return (
    <section className="panel">
      <h2>Capability Gate</h2>
      <div className="gate-grid">
        {FEATURE_ORDER.map((featureCode) => {
          const gate = gates.find((item) => item.featureCode === featureCode);
          const unlocked = entitlement?.features[featureCode] ?? false;
          const quota = entitlement?.remainingQuota[featureCode];
          const fallback = FEATURE_FALLBACK[featureCode];
          return (
            <CapabilityGateCard
              key={featureCode}
              title={gate?.title ?? fallback.title}
              description={gate?.description ?? fallback.description}
              unlocked={unlocked}
              remainingQuota={quota}
            />
          );
        })}
      </div>
    </section>
  );
}
