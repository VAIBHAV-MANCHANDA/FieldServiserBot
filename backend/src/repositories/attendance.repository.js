import { fieldServicerClient } from '../config/fieldservicer.js'
import { logger } from '../utils/logger.js'

export async function listAttendance(limit = 100) {
  try {
    const today = new Date()
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const to = today.toISOString().split('T')[0]

    const data = await fieldServicerClient.getRosterShiftList({
      locationId: 0,
      clientId: 0,
      fromDate: from,
      toDate: to,
    })

    const raw = Array.isArray(data) ? data : data?.Data ?? data?.Items ?? []
    return raw.slice(0, limit)
  } catch (error) {
    logger.error('Failed to list attendance from FieldServicer API', error)
    const upstreamError = new Error('Unable to load live attendance data from FieldServicer.')
    upstreamError.code = 'FIELDSERVICER_API_ERROR'
    upstreamError.status = 502
    upstreamError.expose = true
    upstreamError.cause = error
    throw upstreamError
  }
}
