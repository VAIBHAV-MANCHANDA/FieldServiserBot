import { query } from '../config/database.js'

export function listShifts(limit = 100) {
  return query('SELECT * FROM shifts ORDER BY shift_date DESC LIMIT ?', [limit])
}

export function listShiftsByEmployee(employeeId) {
  return query('SELECT * FROM shifts WHERE employee_id = ? ORDER BY shift_date DESC', [employeeId])
}
