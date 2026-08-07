import dotenv from 'dotenv'

dotenv.config()

const toNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  // FieldServicer API Configuration
  fieldServicerApiUrl: process.env.FIELDSERVICER_API_URL ?? 'https://app.fieldservicer.com/api',
  fieldServicerUsername: process.env.FIELDSERVICER_USERNAME ?? '',
  fieldServicerPassword: process.env.FIELDSERVICER_PASSWORD ?? '',
  fieldServicerForPortal: process.env.FIELDSERVICER_FOR_PORTAL !== 'false',
  fieldServicerCacheTtlMs: toNumber(process.env.FIELDSERVICER_CACHE_TTL_MS, 30000),
  // AI Configuration
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  isProduction: process.env.NODE_ENV === 'production',
  maxReportDateRangeDays: toNumber(process.env.MAX_REPORT_DATE_RANGE_DAYS, 366),
  maxReportRows: toNumber(process.env.MAX_REPORT_ROWS, 100),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 5000),
}

export function validateEnv() {
  const missing = []

  if (!env.fieldServicerApiUrl) missing.push('FIELDSERVICER_API_URL')
  if (!env.fieldServicerUsername) missing.push('FIELDSERVICER_USERNAME')
  if (!env.fieldServicerPassword) missing.push('FIELDSERVICER_PASSWORD')

  if (missing.length > 0) {
    const error = new Error(`Missing required environment variables: ${missing.join(', ')}`)
    error.code = 'ENV_VALIDATION_FAILED'
    throw error
  }

  return {
    geminiConfigured: Boolean(env.geminiApiKey),
    fieldServicerConfigured: Boolean(env.fieldServicerApiUrl && env.fieldServicerUsername && env.fieldServicerPassword),
  }
}
