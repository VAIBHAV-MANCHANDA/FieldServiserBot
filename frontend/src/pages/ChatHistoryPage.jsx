import { useEffect } from 'react'
import ChatMessage from '../components/chat/ChatMessage.jsx'
import ErrorMessage from '../components/common/ErrorMessage.jsx'
import Loader from '../components/common/Loader.jsx'
import { useChat } from '../hooks/useChat.js'

export default function ChatHistoryPage() {
  const {
    error,
    isLoadingSessions,
    loadSession,
    loadSessions,
    messages,
    sessions,
  } = useChat()

  useEffect(() => {
    loadSessions()
    // The hook exposes an action function; this page intentionally loads once on mount.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page">
      <section className="panel history-panel">
        <header className="panel__header">
          <div>
            <p className="panel__eyebrow">Sessions</p>
            <h2 className="panel__title">Chat history</h2>
            <p className="panel__subtitle">Saved database-backed conversations.</p>
          </div>
        </header>

        <div className="panel__body history-panel__body">
          <ErrorMessage message={error} />
          {isLoadingSessions ? <Loader label="Loading sessions..." /> : null}

          {sessions.length === 0 && !isLoadingSessions ? (
            <div className="empty-state">No chat sessions yet.</div>
          ) : null}

          <div className="history-list">
            {sessions.map((session) => (
              <button
                key={session.session_uuid}
                type="button"
                className="session-row"
                onClick={() => loadSession(session.session_uuid)}
              >
                <span>{session.session_title}</span>
                <small>{session.message_count} messages</small>
              </button>
            ))}
          </div>

          {messages.length > 0 ? (
            <div className="history-preview">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
