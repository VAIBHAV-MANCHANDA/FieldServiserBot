import { Router } from 'express'
import { checkDatabaseHealth } from '../config/database.js'
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

router.get('/health/database', async (req, res) => {
  const health = await checkDatabaseHealth()
  res.status(health.connected ? 200 : 503).json({
    data: health,
    success: health.connected,
  })
})

router.use('/auth', authRoutes)
router.use('/chat', chatRoutes)
router.use('/reports', reportRoutes)

export default router
