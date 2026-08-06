import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { env } from '../src/config/env.js'
import { logger } from '../src/utils/logger.js'
import { generateSeedData } from './generateSeedData.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..')

function toMysqlDateTime(value) {
  if (!value) return null
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
}

function splitSql(sql) {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function runSqlFile(connection, fileName) {
  const sql = await fs.readFile(path.join(rootDir, 'database', fileName), 'utf8')

  for (const statement of splitSql(sql)) {
    await connection.query(statement)
  }
}

async function main() {
  let adminConnection
  let connection

  try {
    adminConnection = await mysql.createConnection({
      host: env.dbHost,
      password: env.dbPassword,
      port: env.dbPort,
      user: env.dbUser,
      multipleStatements: false,
    })

    await runSqlFile(adminConnection, '01-create-database.sql')
  } catch (error) {
    logger.error('Unable to connect to MySQL for database creation.', {
      code: error.code,
      message: error.message,
    })
    process.exitCode = 1
    return
  } finally {
    await adminConnection?.end()
  }

  const data = generateSeedData()

  try {
    connection = await mysql.createConnection({
      database: env.dbName,
      host: env.dbHost,
      password: env.dbPassword,
      port: env.dbPort,
      user: env.dbUser,
      multipleStatements: false,
      decimalNumbers: true,
    })

    await runSqlFile(connection, '02-create-tables.sql')
    await runSqlFile(connection, '03-create-indexes.sql').catch(() => undefined)
    await runSqlFile(connection, '04-create-views.sql')

    await connection.beginTransaction()
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')

    for (const table of ['ai_query_logs', 'chat_messages', 'chat_sessions', 'shift_attendance', 'shifts', 'sites', 'customers', 'employees']) {
      await connection.query(`TRUNCATE TABLE ${table}`)
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1')

    const [employeeResult] = await connection.query(
      `INSERT INTO employees
       (employee_code, employee_name, email, department, position, hourly_pay_rate, is_active)
       VALUES ?`,
      [data.employees.map((employee) => [
        employee.employee_code,
        employee.employee_name,
        employee.email,
        employee.department,
        employee.position,
        employee.hourly_pay_rate,
        employee.is_active,
      ])],
    )

    const [customerResult] = await connection.query(
      `INSERT INTO customers
       (customer_code, customer_name, industry, is_active)
       VALUES ?`,
      [data.customers.map((customer) => [
        customer.customer_code,
        customer.customer_name,
        customer.industry,
        customer.is_active,
      ])],
    )

    const customerIds = data.customers.map((_, index) => customerResult.insertId + index)

    const [siteResult] = await connection.query(
      `INSERT INTO sites
       (customer_id, site_code, site_name, address, city, latitude, longitude, is_active)
       VALUES ?`,
      [data.sites.map((site) => [
        customerIds[site.customerIndex],
        site.site_code,
        site.site_name,
        site.address,
        site.city,
        site.latitude,
        site.longitude,
        site.is_active,
      ])],
    )

    const employeeIds = data.employees.map((_, index) => employeeResult.insertId + index)
    const siteIds = data.sites.map((_, index) => siteResult.insertId + index)

    const [shiftResult] = await connection.query(
      `INSERT INTO shifts
       (employee_id, customer_id, site_id, shift_date, scheduled_start, scheduled_end, shift_status, pay_rate, charge_rate)
       VALUES ?`,
      [data.shifts.map((shift) => [
        shift.employeeIndex === null ? null : employeeIds[shift.employeeIndex],
        customerIds[shift.customerIndex],
        siteIds[shift.siteIndex],
        toMysqlDateTime(shift.shift_date).slice(0, 10),
        toMysqlDateTime(shift.scheduled_start),
        toMysqlDateTime(shift.scheduled_end),
        shift.shift_status,
        shift.pay_rate,
        shift.charge_rate,
      ])],
    )

    const shiftIds = data.shifts.map((_, index) => shiftResult.insertId + index)

    await connection.query(
      `INSERT INTO shift_attendance
       (shift_id, clock_in_datetime, clock_out_datetime, rostered_hours, actual_hours, late_minutes, early_leave_minutes, overtime_hours, attendance_status)
       VALUES ?`,
      [data.attendance.map((record) => [
        shiftIds[record.shiftIndex],
        toMysqlDateTime(record.clock_in_datetime),
        toMysqlDateTime(record.clock_out_datetime),
        record.rostered_hours,
        record.actual_hours,
        record.late_minutes,
        record.early_leave_minutes,
        record.overtime_hours,
        record.attendance_status,
      ])],
    )

    await connection.commit()

    logger.info('Seed data loaded.', {
      attendance: data.attendance.length,
      customers: data.customers.length,
      employees: data.employees.length,
      shifts: data.shifts.length,
      sites: data.sites.length,
    })
  } catch (error) {
    await connection?.rollback()
    logger.error('Seed failed. Transaction rolled back.', {
      code: error.code,
      message: error.message,
    })
    process.exitCode = 1
  } finally {
    await connection?.end()
  }
}

main()
