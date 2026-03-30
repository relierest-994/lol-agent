import type { MatchAskAnswer } from '../../domain';
import { SuggestedQuestionList } from './suggested-question-list';

interface MatchAskPanelProps {
  value: string;
  onChange: (value: string) => void;
  onAsk: () => void;
  running: boolean;
  answer?: MatchAskAnswer['answer'];
  suggestedQuestions: string[];
  onUseSuggested: (question: string) => void;
  lockedInfo?: string;
}

export function MatchAskPanel({
  value,
  onChange,
  onAsk,
  running,
  answer,
  suggestedQuestions,
  onUseSuggested,
  lockedInfo,
}: MatchAskPanelProps) {
  return (
    <section className="panel">
      <h2>对局追问</h2>
      <textarea
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="围绕当前对局继续提问..."
      />
      <div className="control-row">
        <button type="button" disabled={running} onClick={onAsk}>
          {running ? '正在组织回答...' : '发起追问'}
        </button>
      </div>
      {lockedInfo && <p className="locked">{lockedInfo}</p>}

      {answer && (
        <div className="report-grid">
          <article className="report-card">
            <h3>回答摘要</h3>
            <p>{answer.summary}</p>
          </article>
          {answer.sections.map((section) => (
            <article key={section.section_title} className="report-card">
              <h3>{section.section_title}</h3>
              <p>{section.insight}</p>
              <ul>
                {section.evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>{section.advice}</p>
            </article>
          ))}
        </div>
      )}

      <h3>推荐追问</h3>
      <SuggestedQuestionList questions={suggestedQuestions} onSelect={onUseSuggested} disabled={running} />
    </section>
  );
}
