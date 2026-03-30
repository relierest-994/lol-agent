import type { BasicReviewReport } from '../../domain';
import { ReviewSummaryCard } from './review-summary-card';

interface ReportRendererProps {
  report?: BasicReviewReport;
  lockedInfo?: string;
  error?: string;
}

const ORDER = ['本局总评', '输赢关键点', '玩家问题 Top 3', '玩家亮点 Top 3', '下局建议 Top 3'] as const;

export function ReportRenderer({ report, lockedInfo, error }: ReportRendererProps) {
  const orderedSections = report
    ? ORDER.map((title) => report.sections.find((item) => item.title === title)).filter(Boolean)
    : [];

  const sections = orderedSections.length > 0 ? orderedSections : report?.sections ?? [];

  return (
    <section className="panel report-panel">
      <h2>基础复盘</h2>
      {error && <p className="error">{error}</p>}
      {!report && !error && !lockedInfo && <p className="muted">等待复盘结果...</p>}
      {lockedInfo && <p className="locked">能力未解锁：{lockedInfo}</p>}
      {report && (
        <div className="report-grid">
          {sections.map((section) => (
            <ReviewSummaryCard key={section?.title} title={section?.title ?? '分段'} lines={section?.lines ?? []} />
          ))}
        </div>
      )}
    </section>
  );
}
