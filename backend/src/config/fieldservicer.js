import axios from 'axios'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

class FieldServicerClient {
  constructor() {
    this.baseURL = env.fieldServicerApiUrl
    this.username = env.fieldServicerUsername
    this.password = env.fieldServicerPassword
    this.forPortal = env.fieldServicerForPortal
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        // Skip token for login endpoint
        if (config.url?.includes('/Auth/Login')) {
          return config
        }

        // Ensure we have a valid token
        await this.ensureValidToken()

        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }

        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // If 401 and we haven't retried yet, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            await this.login()
            return this.client(originalRequest)
          } catch (refreshError) {
            logger.error('Token refresh failed', refreshError)
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * Login to FieldServicer API
   */
  async login() {
    try {
      const response = await this.client.post('/Auth/Login', {
        Username: this.username,
        Password: this.password,
        ForPortal: this.forPortal,
        ForLMS: false,
      })

      if (response.data?.AccessToken) {
        this.accessToken = response.data.AccessToken
        this.refreshToken = response.data.RefreshToken
        
        // Decode JWT to get expiry (basic parsing)
        if (this.accessToken) {
          try {
            const payload = JSON.parse(Buffer.from(this.accessToken.split('.')[1], 'base64').toString())
            this.tokenExpiry = payload.exp ? payload.exp * 1000 : Date.now() + 15 * 60 * 1000 // Default 15 min
          } catch {
            // If parsing fails, set expiry to 15 minutes from now
            this.tokenExpiry = Date.now() + 15 * 60 * 1000
          }
        }

        logger.info('FieldServicer API authentication successful')
        return response.data
      }

      throw new Error('No access token received from login')
    } catch (error) {
      logger.error('FieldServicer login failed', {
        error: error.message,
        response: error.response?.data,
      })
      throw error
    }
  }

  /**
   * Ensure we have a valid token, refresh if needed
   */
  async ensureValidToken() {
    // If no token or token is expired (with 1 minute buffer)
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry - 60000) {
      await this.login()
    }
  }

  /**
   * Get roster/shift list
   * Returns a flat array of shift objects.
   */
  async getRosterShiftList({ locationId = 0, clientId = 0, fromDate, toDate }) {
    try {
      const response = await this.client.get('/Shift/RosterShiftList', {
        params: {
          LocationID: locationId,
          ClientID: clientId,
          FromDate: fromDate,
          ToDate: toDate,
        },
      })

      // API returns a plain array directly
      const data = response.data
      return Array.isArray(data) ? data : data?.Data ?? data?.Items ?? data?.Result ?? []
    } catch (error) {
      logger.error('Failed to fetch roster shift list', {
        error: error.message,
        locationId,
        clientId,
        fromDate,
        toDate,
      })
      throw error
    }
  }

  /**
   * Generic GET request
   */
  async get(endpoint, params = {}) {
    try {
      const response = await this.client.get(endpoint, { params })
      return response.data
    } catch (error) {
      logger.error(`GET ${endpoint} failed`, { error: error.message, params })
      throw error
    }
  }

  /**
   * Generic POST request
   */
  async post(endpoint, data = {}) {
    try {
      const response = await this.client.post(endpoint, data)
      return response.data
    } catch (error) {
      logger.error(`POST ${endpoint} failed`, { error: error.message })
      throw error
    }
  }
}

// Singleton instance
export const fieldServicerClient = new FieldServicerClient()
