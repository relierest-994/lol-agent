interface ReviewSummaryCardProps {
  title: string;
  lines: string[];
}

export function ReviewSummaryCard({ title, lines }: ReviewSummaryCardProps) {
  return (
    <article className="report-card">
      <h3>{title}</h3>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}
