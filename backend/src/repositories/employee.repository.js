import { fieldServicerClient } from '../config/fieldservicer.js'
import { logger } from '../utils/logger.js'

/**
 * Employee data derived from roster shifts (FieldServicer API).
 * Until a dedicated /Employee endpoint is wired, we extract
 * unique employees from the current month's roster.
 */
export async function listEmployees() {
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
    const seen = new Map()

    for (const s of raw) {
      const id = s.EmployeeID
      if (id && !seen.has(id)) {
        seen.set(id, {
          id,
          employee_name: s.EmployeeName ?? 'Unknown',
          department: s.ShiftType ?? 'Work',
          position: s.ShiftType ?? 'Staff',
          is_active: 1,
        })
      }
    }

    return [...seen.values()].sort((a, b) => a.employee_name.localeCompare(b.employee_name))
  } catch (error) {
    logger.error('Failed to list employees from FieldServicer API', error)
    const upstreamError = new Error('Unable to load live employee data from FieldServicer.')
    upstreamError.code = 'FIELDSERVICER_API_ERROR'
    upstreamError.status = 502
    upstreamError.expose = true
    upstreamError.cause = error
    throw upstreamError
  }
}

export async function findEmployeeById(id) {
  const employees = await listEmployees()
  return employees.find(e => e.id == id) ?? null
}
