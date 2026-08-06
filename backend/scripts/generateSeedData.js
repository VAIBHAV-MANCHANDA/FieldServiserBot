import { faker } from '@faker-js/faker'

faker.seed(424242)

const DEPARTMENTS = ['Operations', 'Security', 'Facilities', 'Logistics', 'Customer Care']
const POSITIONS = ['Field Technician', 'Shift Lead', 'Site Guard', 'Dispatcher', 'Maintenance Specialist']
const SHIFT_STATUSES = ['Completed', 'Missed', 'Unfilled', 'Cancelled', 'Scheduled', 'In Progress']
const CUSTOMER_NAMES = ['Northwind Retail', 'Contoso Aviation', 'Aster Health', 'Bluepeak Energy', 'Cityline Transit', 'Summit Hospitality']
const SITE_NAMES = ['Airport Site', 'Downtown Hub', 'North Depot', 'River Plant', 'Medical Center', 'Harbor Gate', 'West Campus', 'East Terminal', 'Central Warehouse', 'Uptown Mall', 'Logistics Park', 'Solar Yard']

function randomFrom(list) {
  return list[faker.number.int({ max: list.length - 1, min: 0 })]
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600000)
}

function round2(value) {
  return Number(value.toFixed(2))
}

function coordinate(min, max) {
  return faker.number.float({ fractionDigits: 6, max, min })
}

function pickShiftStatus(index) {
  const roll = (index * 37) % 100
  if (roll < 73) return 'Completed'
  if (roll < 82) return 'Missed'
  if (roll < 92) return 'Unfilled'
  if (roll < 98) return 'Cancelled'
  return index % 2 === 0 ? 'Scheduled' : 'In Progress'
}

export function generateSeedData(now = new Date()) {
  faker.seed(424242)

  const employees = Array.from({ length: 25 }, (_, index) => {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    return {
      department: randomFrom(DEPARTMENTS),
      email: `employee.${index + 1}@workforce-ai.local`,
      employee_code: `EMP-${String(index + 1).padStart(4, '0')}`,
      employee_name: `${firstName} ${lastName}`,
      hourly_pay_rate: faker.number.float({ fractionDigits: 2, max: 34, min: 18 }),
      is_active: index < 23 ? 1 : 0,
      position: randomFrom(POSITIONS),
    }
  })

  const customers = CUSTOMER_NAMES.map((name, index) => ({
    customer_code: `CUS-${String(index + 1).padStart(3, '0')}`,
    customer_name: name,
    industry: randomFrom(['Retail', 'Aviation', 'Healthcare', 'Energy', 'Transport', 'Hospitality']),
    is_active: 1,
  }))

  const sites = SITE_NAMES.map((siteName, index) => ({
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    customerIndex: index % customers.length,
    is_active: 1,
    latitude: coordinate(34, 41),
    longitude: coordinate(-121, -72),
    site_code: `SITE-${String(index + 1).padStart(3, '0')}`,
    site_name: siteName,
  }))

  const shifts = []
  const attendance = []
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  for (let index = 0; index < 1500; index += 1) {
    const status = pickShiftStatus(index)
    const siteIndex = index % sites.length
    const customerIndex = sites[siteIndex].customerIndex
    const employeeIndex = status === 'Unfilled' ? null : index % employees.length
    const shiftDate = faker.date.between({ from: sixMonthsAgo, to: now })
    const startsAtNight = index % 9 === 0
    const startHour = startsAtNight ? faker.number.int({ max: 22, min: 18 }) : faker.number.int({ max: 10, min: 5 })
    const scheduledStart = new Date(shiftDate)
    scheduledStart.setHours(startHour, index % 2 === 0 ? 0 : 30, 0, 0)
    const scheduledEnd = addHours(scheduledStart, startsAtNight ? 10 : 8)
    const payRate = employeeIndex === null
      ? faker.number.float({ fractionDigits: 2, max: 32, min: 19 })
      : employees[employeeIndex].hourly_pay_rate

    shifts.push({
      charge_rate: round2(payRate * faker.number.float({ fractionDigits: 2, max: 1.95, min: 1.45 })),
      customerIndex,
      employeeIndex,
      pay_rate: payRate,
      scheduled_end: scheduledEnd,
      scheduled_start: scheduledStart,
      shift_date: scheduledStart,
      shift_status: status,
      siteIndex,
    })

    if (status === 'Cancelled') {
      continue
    }

    const rosteredHours = round2((scheduledEnd - scheduledStart) / 3600000)
    const lateMinutes = status === 'Missed' ? 0 : index % 8 === 0 ? faker.number.int({ max: 45, min: 8 }) : 0
    const earlyLeaveMinutes = status === 'Completed' && index % 13 === 0 ? faker.number.int({ max: 35, min: 5 }) : 0
    const overtimeHours = status === 'Completed' && index % 11 === 0 ? faker.number.float({ fractionDigits: 2, max: 2, min: 0.25 }) : 0
    const clockIn = status === 'Missed' || status === 'Unfilled'
      ? null
      : new Date(scheduledStart.getTime() + lateMinutes * 60000)
    const missingClockOut = status === 'In Progress' || index % 29 === 0
    const actualHours = status === 'Missed' || status === 'Unfilled'
      ? 0
      : missingClockOut
        ? round2(Math.max(0.5, rosteredHours / 2))
        : round2(Math.max(0, rosteredHours - earlyLeaveMinutes / 60 + overtimeHours))
    const clockOut = clockIn && !missingClockOut ? addHours(clockIn, actualHours) : null
    const attendanceStatus = status === 'Unfilled'
      ? 'Not Started'
      : status === 'Missed'
      ? 'Missed'
      : missingClockOut
        ? 'Clocked In'
        : lateMinutes > 0
          ? 'Late'
          : 'Completed'

    attendance.push({
      actual_hours: actualHours,
      attendance_status: attendanceStatus,
      clock_in_datetime: clockIn,
      clock_out_datetime: clockOut,
      early_leave_minutes: earlyLeaveMinutes,
      late_minutes: lateMinutes,
      overtime_hours: overtimeHours,
      rostered_hours: rosteredHours,
      shiftIndex: index,
    })
  }

  return {
    attendance,
    customers,
    employees,
    shifts,
    sites,
  }
}
