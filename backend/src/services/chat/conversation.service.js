import crypto from 'node:crypto'
import {
  createSession,
  deleteSession,
  findSessionByUuid,
  getRecentMessages,
  listSessions,
  saveMessage,
} from '../../repositories/chat.repository.js'

export async function getOrCreateSession(sessionUuid, title = 'New analytics chat') {
  if (sessionUuid) {
    const existing = await findSessionByUuid(sessionUuid)

    if (!existing) {
      const error = new Error('Chat session was not found.')
      error.code = 'INVALID_SESSION'
      error.status = 404
      throw error
    }

    return existing
  }

  return createSession({
    sessionTitle: title,
    sessionUuid: crypto.randomUUID(),
  })
}

export async function loadConversationContext(sessionId, limit = 8) {
  const messages = await getRecentMessages(sessionId, limit)
  const previousAssistant = messages.find((message) => message.message_role === 'assistant' && message.intent_json)

  return {
    messages: messages.reverse().map((message) => ({
      content: message.message_text,
      intent: message.intent_json,
      role: message.message_role,
    })),
    previousIntent: previousAssistant?.intent_json ?? null,
  }
}

export function addConversationMessage({ chart = null, intent = null, role, sessionId, text }) {
  return saveMessage({
    chart,
    intent,
    role,
    sessionId,
    text,
  })
}

export { deleteSession, findSessionByUuid, listSessions }
