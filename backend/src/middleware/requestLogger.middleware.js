import crypto from 'node:crypto'
import morgan from 'morgan'
import { logger } from '../utils/logger.js'

export function requestIdMiddleware(req, res, next) {
  req.id = crypto.randomUUID()
  res.setHeader('x-request-id', req.id)
  next()
}

export const requestLogger = morgan(':method :url :status :response-time ms', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
})
