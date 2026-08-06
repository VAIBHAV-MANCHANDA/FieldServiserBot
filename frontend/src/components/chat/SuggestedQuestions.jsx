export default function SuggestedQuestions({
  onSelect,
  questions = [],
  title = 'Suggested questions',
}) {
  if (!questions.length) {
    return null
  }

  return (
    <section className="suggested-questions" aria-label={title}>
      <div className="suggested-questions__title">{title}</div>
      <div className="suggested-questions__list">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            className="suggested-questions__button"
            onClick={() => onSelect?.(question)}
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  )
}
