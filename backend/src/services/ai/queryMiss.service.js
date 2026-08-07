import { logger } from '../../utils/logger.js'

const MAX_RECENT_MISSES = 200
const recentMisses = []

export function logQueryMiss({ args, functionCalled, query, reason, rowCount = null }) {
  const entry = {
    args: args ?? null,
    functionCalled: functionCalled ?? null,
    query: String(query ?? '').slice(0, 800),
    reason,
    rowCount,
    timestamp: new Date().toISOString(),
  }

  recentMisses.unshift(entry)
  if (recentMisses.length > MAX_RECENT_MISSES) recentMisses.length = MAX_RECENT_MISSES

  logger.warn('Workforce query selection needs review.', {
    event: 'query_miss',
    ...entry,
  })

  return entry
}

export function listRecentQueryMisses() {
  return recentMisses.map(entry => ({ ...entry }))
}
