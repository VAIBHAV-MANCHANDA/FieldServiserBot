import { Router } from 'express'
import { fieldServicerClient } from '../config/fieldservicer.js'
import authRoutes from './auth.routes.js'
import chatRoutes from './chat.routes.js'
import reportRoutes from './report.routes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({
    service: 'ai-workforce-analytics-c',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

router.get('/health/fieldservicer', async (req, res) => {
  const startedAt = Date.now()
  try {
    await fieldServicerClient.ensureValidToken()
    res.status(200).json({
      data: {
        connected: true,
        source: 'FieldServicer API',
        latencyMs: Date.now() - startedAt,
      },
      success: true,
    })
  } catch (error) {
    res.status(503).json({
      data: {
        connected: false,
        source: 'FieldServicer API',
        error: 'FieldServicer API connection failed.',
        latencyMs: Date.now() - startedAt,
      },
      success: false,
    })
  }
})

router.use('/auth', authRoutes)
router.use('/chat', chatRoutes)
router.use('/reports', reportRoutes)

export default router
