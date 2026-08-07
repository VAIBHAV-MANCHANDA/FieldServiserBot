/**
 * In-memory chat storage for the lifetime of the server process.
 * Sessions and messages are stored in Maps for the lifetime of the server process.
 */

import crypto from 'node:crypto'

// In-memory stores
const sessions = new Map()   // uuid → session object
const messages = new Map()   // sessionId (numeric) → message[]

let nextSessionId = 1
let nextMessageId = 1

function parseJsonField(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeMessage(msg) {
  return {
    ...msg,
    chart_json: parseJsonField(msg.chart_json),
    intent_json: parseJsonField(msg.intent_json),
  }
}

export async function createSession({ sessionTitle, sessionUuid }) {
  const id = nextSessionId++
  const now = new Date().toISOString()
  const session = {
    id,
    session_uuid: sessionUuid ?? crypto.randomUUID(),
    session_title: sessionTitle,
    created_at: now,
    updated_at: now,
  }
  sessions.set(session.session_uuid, session)
  messages.set(id, [])
  return session
}

export async function findSessionByUuid(sessionUuid) {
  return sessions.get(sessionUuid) ?? null
}

export async function listSessions() {
  return [...sessions.values()]
    .map(s => ({
      session_uuid: s.session_uuid,
      session_title: s.session_title,
      created_at: s.created_at,
      updated_at: s.updated_at,
      message_count: (messages.get(s.id) ?? []).length,
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function deleteSession(sessionUuid) {
  const session = sessions.get(sessionUuid)
  if (!session) return false
  sessions.delete(sessionUuid)
  messages.delete(session.id)
  return true
}

export async function getSessionMessages(sessionUuid) {
  const session = sessions.get(sessionUuid)
  if (!session) return null
  const msgs = (messages.get(session.id) ?? []).map(normalizeMessage)
  return { messages: msgs, session }
}

export async function getRecentMessages(sessionId, limit = 8) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 50))
  const msgs = messages.get(sessionId) ?? []
  return msgs.slice(-safeLimit).map(normalizeMessage)
}

export async function saveMessage({ chart = null, intent = null, role, sessionId, text }) {
  const id = nextMessageId++
  const now = new Date().toISOString()
  const msg = {
    id,
    session_id: sessionId,
    message_role: role,
    message_text: text,
    intent_json: intent ? JSON.stringify(intent) : null,
    chart_json: chart ? JSON.stringify(chart) : null,
    created_at: now,
  }

  const sessionMsgs = messages.get(sessionId) ?? []
  sessionMsgs.push(msg)
  messages.set(sessionId, sessionMsgs)

  // Update session timestamp
  for (const [uuid, s] of sessions.entries()) {
    if (s.id === sessionId) {
      sessions.set(uuid, { ...s, updated_at: now })
      break
    }
  }

  return { id, message_role: role, message_text: text }
}
