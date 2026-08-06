import { deleteSession, findSessionByUuid, listSessions } from '../services/chat/conversation.service.js'
import { getSessionMessages } from '../repositories/chat.repository.js'
import { runChatQuery } from '../services/chat/chat.service.js'
import { validateChatQuery } from '../validators/chat.validator.js'
import { sendSuccess } from '../utils/response.js'

export async function postChatQuery(req, res, next) {
  try {
    const value = validateChatQuery(req.body)
    const result = await runChatQuery(value)
    sendSuccess(res, result, 'Chat query completed.')
  } catch (error) {
    next(error)
  }
}

export async function getChatSessions(req, res, next) {
  try {
    sendSuccess(res, { sessions: await listSessions() }, 'Chat sessions loaded.')
  } catch (error) {
    next(error)
  }
}

export async function getChatSession(req, res, next) {
  try {
    const result = await getSessionMessages(req.params.sessionId)

    if (!result) {
      res.status(404).json({
        code: 'INVALID_SESSION',
        message: 'Chat session was not found.',
        success: false,
      })
      return
    }

    sendSuccess(res, result, 'Chat session loaded.')
  } catch (error) {
    next(error)
  }
}

export async function deleteChatSession(req, res, next) {
  try {
    const removed = await deleteSession(req.params.sessionId)

    if (!removed) {
      res.status(404).json({
        code: 'INVALID_SESSION',
        message: 'Chat session was not found.',
        success: false,
      })
      return
    }

    sendSuccess(res, { deleted: true }, 'Chat session deleted.')
  } catch (error) {
    next(error)
  }
}

export async function getChatHistory(req, res, next) {
  try {
    const session = req.query.sessionId ? await findSessionByUuid(req.query.sessionId) : null
    sendSuccess(res, { history: session ? (await getSessionMessages(session.session_uuid)).messages : [] }, 'Chat history loaded.')
  } catch (error) {
    next(error)
  }
}
