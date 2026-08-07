import { useEffect, useRef, useState } from 'react'
import ChatInput from './ChatInput.jsx'
import ChatMessage from './ChatMessage.jsx'
import SuggestedQuestions from './SuggestedQuestions.jsx'
import ErrorMessage from '../common/ErrorMessage.jsx'
import Loader from '../common/Loader.jsx'

export default function ChatBox({
  error,
  isSending = false,
  messages = [],
  onClear,
  onSend,
  suggestedQuestions = [],
  subtitle = 'Ask workforce analytics questions and get live reports from FieldServicer.',
  title = 'AI Workforce Analytics',
}) {
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [isSending, messages.length])

  const handleSubmit = async (value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    await onSend?.(trimmed)
    setDraft('')
  }

  return (
    <section className="panel chat-box">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Chatbot</p>
          <h2 className="panel__title">{title}</h2>
          <p className="panel__subtitle">{subtitle}</p>
        </div>
        {onClear ? (
          <button type="button" className="chip-button" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </header>

      {/* ── TOP input bar ───────────────────────────────────────────── */}
      <ChatInput
        disabled={isSending}
        onChange={setDraft}
        onSubmit={handleSubmit}
        value={draft}
        position="top"
      />

      <SuggestedQuestions questions={suggestedQuestions} onSelect={handleSubmit} />

      <ErrorMessage message={error} />

      {/* ── Message stream ──────────────────────────────────────────── */}
      <div className="chat-box__stream">
        {messages.length === 0 ? (
          <div className="welcome-card">
            <div className="welcome-card__icon" aria-hidden="true">AI</div>
            <div>
              <p className="welcome-card__eyebrow">Ready when you are</p>
              <h3 className="welcome-card__title">Generate workforce insights in seconds.</h3>
              <p className="welcome-card__text">
                Ask about shifts, late clock-ins, customer performance, missed visits, employee hours, or live attendance.
              </p>
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} onSuggestion={handleSubmit} />
        ))}

        {isSending ? <Loader label="AI is preparing your report..." /> : null}
        <div ref={endRef} />
      </div>

      {/* ── BOTTOM input bar ─────────────────────────────────────────── */}
      <ChatInput
        disabled={isSending}
        onChange={setDraft}
        onSubmit={handleSubmit}
        value={draft}
        position="bottom"
      />
    </section>
  )
}
