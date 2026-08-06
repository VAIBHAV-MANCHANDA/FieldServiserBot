import { query } from '../config/database.js'

export function listEmployees() {
  return query('SELECT * FROM employees ORDER BY employee_name')
}

export async function findEmployeeById(id) {
  const rows = await query('SELECT * FROM employees WHERE id = ? LIMIT 1', [id])
  return rows[0] ?? null
}
