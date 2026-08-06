import app from './app.js'
import { env, validateEnv } from './config/env.js'
import { logger } from './utils/logger.js'

try {
  const validation = validateEnv()

  if (!validation.geminiConfigured) {
    logger.warn('GEMINI_API_KEY is missing. Chat queries will return a configuration error.')
  }

  app.listen(env.port, () => {
    logger.info(`Backend running on http://localhost:${env.port}`)
  })
} catch (error) {
  logger.error('Server startup failed.', {
    code: error.code,
    message: error.message,
  })
  process.exit(1)
}
