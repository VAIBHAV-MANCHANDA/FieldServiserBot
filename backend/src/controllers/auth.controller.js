import { login } from '../services/auth/auth.service.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { logger } from '../utils/logger.js'

export async function postLogin(req, res) {
  try {
    const authData = await login()
    sendSuccess(res, authData, 'Authenticated.')
  } catch (error) {
    logger.error('Login controller failed', error)
    sendError(res, 'Authentication failed. Please check your credentials.', 401)
  }
}
