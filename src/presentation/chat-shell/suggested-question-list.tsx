interface SuggestedQuestionListProps {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function SuggestedQuestionList({ questions, onSelect, disabled }: SuggestedQuestionListProps) {
  return (
    <div className="quick-prompts">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          className="ghost-btn"
          disabled={disabled}
          onClick={() => onSelect(question)}
        >
          {question}
        </button>
      ))}
    </div>
  );
}
