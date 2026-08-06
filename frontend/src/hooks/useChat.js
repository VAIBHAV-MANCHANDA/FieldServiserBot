import { useState } from 'react'
import { fetchChatSession, fetchChatSessions, sendChatQuery } from '../api/chatApi.js'
import { CHAT_MESSAGE_ROLES } from '../types/chat.types.js'

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `message-${Date.now()}-${Math.random().toString(16).slice(2)}`

function createUserMessage(content) {
  return {
    content,
    id: createId(),
    role: CHAT_MESSAGE_ROLES.USER,
    timestamp: new Date().toISOString(),
  }
}

function createAssistantMessage(payload) {
  // message may be a string OR { overview, lineInsight, pieInsight, barInsight }
  const msg = payload.message
  const isStructured = msg && typeof msg === 'object'

  return {
    appliedFilters: payload.appliedFilters,
    barChart: payload.barChart ?? payload.chart ?? null,
    barInsight: isStructured ? msg.barInsight : null,
    chart: payload.chart ?? null,
    content: isStructured ? msg.overview : (msg ?? ''),
    id: createId(),
    lineChart: payload.lineChart ?? null,
    lineInsight: isStructured ? msg.lineInsight : null,
    outOfScope: payload.outOfScope ?? false,
    pieChart: payload.pieChart ?? null,
    pieInsight: isStructured ? msg.pieInsight : null,
    role: CHAT_MESSAGE_ROLES.ASSISTANT,
    suggestedQuestions: payload.suggestedQuestions ?? [],
    summaryCards: payload.summaryCards ?? [],
    table: payload.table,
    timestamp: new Date().toISOString(),
    understoodQuery: payload.understoodQuery,
  }
}

function mapPersistedMessage(message) {
  return {
    chart: message.chart_json,
    content: message.message_text,
    id: String(message.id),
    role: message.message_role,
    timestamp: message.created_at,
  }
}

export function useChat() {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [sessions, setSessions] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [error, setError] = useState('')

  const submitMessage = async (value) => {
    const trimmed = value.trim()

    if (!trimmed || isSending) return null

    setMessages((current) => [...current, createUserMessage(trimmed)])
    setIsSending(true)
    setError('')

    try {
      const result = await sendChatQuery({
        message: trimmed,
        sessionId,
      })

      setSessionId(result.sessionId)
      setMessages((current) => [...current, createAssistantMessage(result)])
      return result
    } catch (requestError) {
      setError(requestError.message)
      return null
    } finally {
      setIsSending(false)
    }
  }

  const loadSessions = async () => {
    setIsLoadingSessions(true)
    setError('')

    try {
      setSessions(await fetchChatSessions())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoadingSessions(false)
    }
  }

  const loadSession = async (nextSessionId) => {
    setError('')

    try {
      const result = await fetchChatSession(nextSessionId)
      setSessionId(result.session.session_uuid)
      setMessages(result.messages.map(mapPersistedMessage))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const clearMessages = () => {
    setSessionId(null)
    setMessages([])
    setError('')
  }

  return {
    clearMessages,
    error,
    isLoadingSessions,
    isSending,
    loadSession,
    loadSessions,
    messages,
    sessionId,
    sessions,
    submitMessage,
  }
}
