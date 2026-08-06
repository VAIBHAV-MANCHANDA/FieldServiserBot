import dotenv from 'dotenv'

dotenv.config()

const toNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  dbConnectionLimit: toNumber(process.env.DB_CONNECTION_LIMIT, 10),
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbName: process.env.DB_NAME ?? 'workforce_ai',
  dbPassword: process.env.DB_PASSWORD ?? '',
  dbPort: toNumber(process.env.DB_PORT, 3306),
  dbUser: process.env.DB_USER ?? 'root',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  isProduction: process.env.NODE_ENV === 'production',
  maxReportDateRangeDays: toNumber(process.env.MAX_REPORT_DATE_RANGE_DAYS, 366),
  maxReportRows: toNumber(process.env.MAX_REPORT_ROWS, 100),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 5000),
}

export function validateEnv() {
  const missing = []

  if (!env.dbHost) missing.push('DB_HOST')
  if (!env.dbUser) missing.push('DB_USER')
  if (!env.dbName) missing.push('DB_NAME')

  if (missing.length > 0) {
    const error = new Error(`Missing required environment variables: ${missing.join(', ')}`)
    error.code = 'ENV_VALIDATION_FAILED'
    throw error
  }

  return {
    geminiConfigured: Boolean(env.geminiApiKey),
  }
}
