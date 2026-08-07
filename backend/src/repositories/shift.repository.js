import { fieldServicerClient } from '../config/fieldservicer.js'
import { logger } from '../utils/logger.js'

/**
 * List shifts from FieldServicer API
 */
export async function listShifts(limit = 100, { fromDate, toDate, locationId = 0, clientId = 0 } = {}) {
  try {
    // Default to current month if dates not provided
    if (!fromDate || !toDate) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      
      fromDate = firstDay.toISOString().split('T')[0]
      toDate = lastDay.toISOString().split('T')[0]
    }

    const data = await fieldServicerClient.getRosterShiftList({
      locationId,
      clientId,
      fromDate,
      toDate,
    })

    // Return limited results if specified
    return limit ? (data || []).slice(0, limit) : data || []
  } catch (error) {
    logger.error('Failed to list shifts', error)
    throw error
  }
}

/**
 * List shifts by employee from FieldServicer API
 */
export async function listShiftsByEmployee(employeeId, { fromDate, toDate } = {}) {
  try {
    const allShifts = await listShifts(null, { fromDate, toDate })
    
    // Filter by employee ID
    return allShifts.filter(shift => 
      shift.EmployeeID === employeeId || 
      shift.EmployeeCode === employeeId ||
      shift.EmployeeName?.includes(employeeId)
    )
  } catch (error) {
    logger.error('Failed to list shifts by employee', error)
    throw error
  }
}
