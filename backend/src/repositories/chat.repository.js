import { query } from '../config/database.js'

function parseJsonField(value) {
  if (!value) return null
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeMessage(message) {
  return {
    ...message,
    chart_json: parseJsonField(message.chart_json),
    intent_json: parseJsonField(message.intent_json),
  }
}

export async function createSession({ sessionTitle, sessionUuid }) {
  const result = await query(
    'INSERT INTO chat_sessions (session_uuid, session_title) VALUES (?, ?)',
    [sessionUuid, sessionTitle],
  )

  return {
    id: result.insertId,
    session_title: sessionTitle,
    session_uuid: sessionUuid,
  }
}

export async function findSessionByUuid(sessionUuid) {
  const rows = await query('SELECT * FROM chat_sessions WHERE session_uuid = ? LIMIT 1', [sessionUuid])
  return rows[0] ?? null
}

export async function listSessions() {
  return query(
    `SELECT cs.session_uuid, cs.session_title, cs.created_at, cs.updated_at, COUNT(cm.id) AS message_count
     FROM chat_sessions cs
     LEFT JOIN chat_messages cm ON cm.session_id = cs.id
     GROUP BY cs.id
     ORDER BY cs.updated_at DESC`,
  )
}

export async function deleteSession(sessionUuid) {
  const session = await findSessionByUuid(sessionUuid)

  if (!session) return false

  await query('DELETE FROM chat_sessions WHERE id = ?', [session.id])
  return true
}

export async function getSessionMessages(sessionUuid) {
  const session = await findSessionByUuid(sessionUuid)

  if (!session) return null

  const messages = await query(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
    [session.id],
  )

  return {
    messages: messages.map(normalizeMessage),
    session,
  }
}

export async function getRecentMessages(sessionId, limit = 8) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 50))

  const rows = await query(
    `SELECT * FROM chat_messages
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
    [sessionId],
  )

  return rows.map(normalizeMessage)
}

export async function saveMessage({ chart = null, intent = null, role, sessionId, text }) {
  const result = await query(
    `INSERT INTO chat_messages (session_id, message_role, message_text, intent_json, chart_json)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, role, text, intent ? JSON.stringify(intent) : null, chart ? JSON.stringify(chart) : null],
  )

  await query('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId])

  return {
    id: result.insertId,
    message_role: role,
    message_text: text,
  }
}
