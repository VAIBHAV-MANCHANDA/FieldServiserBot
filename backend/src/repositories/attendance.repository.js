import { query } from '../config/database.js'

export function listAttendance(limit = 100) {
  return query(
    `SELECT a.*
     FROM shift_attendance a
     JOIN shifts s ON s.id = a.shift_id
     ORDER BY s.shift_date DESC
     LIMIT ?`,
    [limit],
  )
}
