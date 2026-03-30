import type { EntitlementFeature, EntitlementState } from '../../domain';
import { CapabilityGateCard } from './capability-gate-card';

const FEATURE_ORDER: EntitlementFeature[] = ['AI_FOLLOWUP', 'CLIP_REVIEW'];

const FEATURE_FALLBACK: Record<EntitlementFeature, { title: string; description: string }> = {
  BASIC_REVIEW: { title: '基础复盘', description: '免费能力，输出完整复盘结果' },
  BASIC_GROWTH_SUMMARY: { title: '基础成长摘要', description: '免费能力，输出阶段性成长方向' },
  DEEP_REVIEW: { title: '深度复盘', description: '已并入基础复盘，不单独收费' },
  AI_FOLLOWUP: { title: 'AI 追问', description: '基于当前对局上下文继续追问' },
  CLIP_REVIEW: { title: '视频片段诊断', description: '上传短视频片段进行细节诊断' },
};

interface EntitlementGateProps {
  entitlement?: EntitlementState;
}

export function EntitlementGate({ entitlement }: EntitlementGateProps) {
  const gates = entitlement?.featureGates ?? [];

  return (
    <section className="panel">
      <h2>能力解锁状态</h2>
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
