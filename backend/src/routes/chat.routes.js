import { Router } from 'express'
import {
  deleteChatSession,
  getChatHistory,
  getChatSession,
  getChatSessions,
  postChatQuery,
} from '../controllers/chat.controller.js'
import { chatRateLimit } from '../middleware/rateLimit.middleware.js'

const router = Router()

router.post('/query', chatRateLimit, postChatQuery)
router.get('/history', getChatHistory)
router.get('/sessions', getChatSessions)
router.get('/sessions/:sessionId', getChatSession)
router.delete('/sessions/:sessionId', deleteChatSession)

export default router
