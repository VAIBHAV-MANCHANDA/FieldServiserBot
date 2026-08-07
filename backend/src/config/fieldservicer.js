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
    this.loginPromise = null
    this.rosterCache = new Map()

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

        // Never retry the login request itself; invalid credentials must fail once.
        const isLoginRequest = originalRequest?.url?.includes('/Auth/Login')

        // If 401 and we haven't retried yet, try to refresh token
        if (error.response?.status === 401 && !isLoginRequest && !originalRequest?._retry) {
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
    if (this.loginPromise) return this.loginPromise

    this.loginPromise = this.performLogin()

    try {
      return await this.loginPromise
    } finally {
      this.loginPromise = null
    }
  }

  async performLogin() {
    try {
      const response = await this.client.post('/Auth/Login', {
        Username: this.username,
        Password: this.password,
        ForPortal: this.forPortal,
        ForLMS: false,
      })

      const accessToken = response.data?.access_token ?? response.data?.AccessToken
      const refreshToken = response.data?.refresh_token ?? response.data?.RefreshToken ?? null

      if (accessToken) {
        this.accessToken = accessToken
        this.refreshToken = refreshToken
        
        // Decode JWT to get expiry (basic parsing)
        if (this.accessToken) {
          try {
            const payload = JSON.parse(Buffer.from(this.accessToken.split('.')[1], 'base64').toString())
            this.tokenExpiry = payload.exp
              ? payload.exp * 1000
              : Date.now() + Number(response.data?.expires_in ?? 900) * 1000
          } catch {
            this.tokenExpiry = Date.now() + Number(response.data?.expires_in ?? 900) * 1000
          }
        }

        logger.info('FieldServicer API authentication successful')
        return {
          ...response.data,
          AccessToken: accessToken,
          RefreshToken: refreshToken,
        }
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
  async getRosterShiftList({ locationId = 0, clientId = 0, fromDate, toDate, forceRefresh = false }) {
    const cacheKey = `${locationId}:${clientId}:${fromDate}:${toDate}`
    const cached = this.rosterCache.get(cacheKey)

    if (!forceRefresh && cached?.data && cached.expiresAt > Date.now()) {
      return cached.data
    }

    if (!forceRefresh && cached?.promise) {
      return cached.promise
    }

    const request = this.client.get('/Shift/RosterShiftList', {
        params: {
          LocationID: locationId,
          ClientID: clientId,
          FromDate: fromDate,
          ToDate: toDate,
        },
      })
      .then((response) => {
        const payload = response.data
        const data = Array.isArray(payload) ? payload : payload?.Data ?? payload?.Items ?? payload?.Result ?? []

        this.rosterCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + env.fieldServicerCacheTtlMs,
        })

        return data
      })
      .catch((error) => {
        this.rosterCache.delete(cacheKey)
        logger.error('Failed to fetch roster shift list', {
          error: error.message,
          locationId,
          clientId,
          fromDate,
          toDate,
        })
        throw error
      })

    this.rosterCache.set(cacheKey, { promise: request })
    return request
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
