import mysql from 'mysql2/promise'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

let pool = null

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      database: env.dbName,
      host: env.dbHost,
      password: env.dbPassword,
      port: env.dbPort,
      user: env.dbUser,
      waitForConnections: true,
      connectionLimit: env.dbConnectionLimit,
      queueLimit: 0,
      namedPlaceholders: false,
      decimalNumbers: true,
      dateStrings: true,
    })

    pool.on?.('connection', () => logger.debug('MySQL connection opened.'))
  }

  return pool
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params)
  return rows
}

export async function withTransaction(callback) {
  const connection = await getPool().getConnection()

  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function checkDatabaseHealth() {
  const startedAt = Date.now()

  try {
    const rows = await query('SELECT 1 AS ok')
    return {
      connected: rows[0]?.ok === 1,
      database: env.dbName,
      latencyMs: Date.now() - startedAt,
    }
  } catch (error) {
    logger.error('Database health check failed.', {
      code: error.code,
      message: error.message,
    })

    return {
      connected: false,
      database: env.dbName,
      error: 'Database connection failed.',
      latencyMs: Date.now() - startedAt,
    }
  }
}

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}
