import ChatBox from '../components/chat/ChatBox.jsx'
import { useChat } from '../hooks/useChat.js'
import { STARTER_QUESTIONS } from '../types/chat.types.js'

export default function AiAssistantPage() {
  const {
    clearMessages,
    error,
    isSending,
    messages,
    submitMessage,
  } = useChat()

  return (
    <div className="page">
      <section className="page__hero">
        <div className="page__hero-icon" aria-hidden="true">AI</div>
        <div className="page__hero-copy">
          <p className="page__eyebrow">Database-driven chatbot</p>
          <h2 className="page__headline">Ask smarter questions about your workforce.</h2>
          <p className="page__lede">
            Questions are converted into validated report intents, run against approved MySQL reports, and displayed with charts, cards and tables.
          </p>
        </div>
      </section>

      <ChatBox
        error={error}
        isSending={isSending}
        messages={messages}
        onClear={clearMessages}
        onSend={submitMessage}
        suggestedQuestions={STARTER_QUESTIONS}
      />
    </div>
  )
}
