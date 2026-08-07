import { logger } from '../utils/logger.js'
import { sendError } from '../utils/response.js'

const DEFAULT_ERROR = {
  code: 'SERVER_ERROR',
  message: 'Something went wrong while processing the request.',
  status: 500,
}

function normalizeError(error) {
  if (error?.isJoi) {
    return {
      code: 'INVALID_REQUEST',
      message: error.details?.[0]?.message ?? 'Invalid request data.',
      status: 400,
    }
  }

  if (error?.code === 'ECONNREFUSED') {
    return {
      code: 'UPSTREAM_API_CONNECTION_FAILED',
      message: 'FieldServicer API connection failed.',
      status: 503,
    }
  }

  return {
    code: error?.code ?? DEFAULT_ERROR.code,
    message: error?.expose ? error.message : error?.message ?? DEFAULT_ERROR.message,
    status: error?.status ?? DEFAULT_ERROR.status,
  }
}

export function notFoundMiddleware(req, res) {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND')
}

export function errorMiddleware(error, req, res, next) {
  const normalized = normalizeError(error)

  logger.error(normalized.message, {
    code: normalized.code,
    method: req.method,
    path: req.originalUrl,
    requestId: req.id,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  })

  if (res.headersSent) {
    next(error)
    return
  }

  sendError(res, normalized.message, normalized.status, normalized.code)
}
