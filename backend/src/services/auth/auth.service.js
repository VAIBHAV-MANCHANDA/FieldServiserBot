import { fieldServicerClient } from '../../config/fieldservicer.js'
import { logger } from '../../utils/logger.js'

/**
 * Login using FieldServicer API
 */
export async function login() {
  try {
    const authData = await fieldServicerClient.login()
    
    // Extract user info from JWT token
    let userId = 'unknown'
    let userName = 'Field Operator'
    
    if (authData.AccessToken) {
      try {
        const payload = JSON.parse(Buffer.from(authData.AccessToken.split('.')[1], 'base64').toString())
        userId = payload.unique_name || payload.sub || 'unknown'
        userName = payload.name || payload.unique_name || 'Field Operator'
      } catch (error) {
        logger.warn('Failed to parse JWT token', error)
      }
    }

    return {
      token: authData.AccessToken,
      refreshToken: authData.RefreshToken,
      user: {
        id: userId,
        name: userName,
        role: 'admin',
      },
    }
  } catch (error) {
    logger.error('Login service failed', error)
    throw error
  }
}
