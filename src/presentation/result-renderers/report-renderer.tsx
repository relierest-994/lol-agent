import type { BasicReviewReport } from '../../domain';
import { ReviewSummaryCard } from './review-summary-card';

interface ReportRendererProps {
  report?: BasicReviewReport;
  lockedInfo?: string;
  error?: string;
}

const ORDER = ['本局总评', '输赢关键点', '玩家问题 Top 3', '玩家亮点 Top 3', '下局建议 Top 3'] as const;

export function ReportRenderer({ report, lockedInfo, error }: ReportRendererProps) {
  const orderedSections = ORDER.map((title) => report?.sections.find((item) => item.title === title)).filter(Boolean);

  return (
    <section className="panel report-panel">
      <h2>Review Summary</h2>
      {error && <p className="error">{error}</p>}
      {!report && !error && !lockedInfo && <p className="muted">Waiting for basic review result...</p>}
      {lockedInfo && <p className="locked">Capability locked: {lockedInfo}</p>}
      {report && (
        <div className="report-grid">
          {orderedSections.map((section) => (
            <ReviewSummaryCard key={section?.title} title={section?.title ?? 'Section'} lines={section?.lines ?? []} />
          ))}
        </div>
      )}
    </section>
  );
}
