const numberFormat = 'number'
const currencyFormat = 'currency'
const dateFormat = 'date'

export const DATA_LOOKUP_ENTITIES = {
  attendance: {
    baseSql: `
      FROM shift_attendance a
      JOIN shifts s ON s.id = a.shift_id
      LEFT JOIN employees e ON e.id = s.employee_id
      JOIN customers c ON c.id = s.customer_id
      JOIN sites st ON st.id = s.site_id
    `,
    columns: [
      { expression: 'a.id', key: 'attendance_id', label: 'Attendance ID' },
      { expression: 's.shift_date', format: dateFormat, key: 'shift_date', label: 'Shift Date' },
      { expression: 'e.employee_name', key: 'employee_name', label: 'Employee' },
      { expression: 'a.attendance_status', key: 'attendance_status', label: 'Attendance Status' },
      { expression: 's.shift_status', key: 'shift_status', label: 'Shift Status' },
      { expression: 'a.clock_in_datetime', key: 'clock_in_datetime', label: 'Clock In' },
      { expression: 'a.clock_out_datetime', key: 'clock_out_datetime', label: 'Clock Out' },
      { expression: 'a.rostered_hours', format: numberFormat, key: 'rostered_hours', label: 'Rostered Hours' },
      { expression: 'a.actual_hours', format: numberFormat, key: 'actual_hours', label: 'Actual Hours' },
      { expression: 'a.late_minutes', format: numberFormat, key: 'late_minutes', label: 'Late Minutes' },
      { expression: 'a.overtime_hours', format: numberFormat, key: 'overtime_hours', label: 'Overtime Hours' },
      { expression: 'c.customer_name', key: 'customer_name', label: 'Customer' },
      { expression: 'st.site_name', key: 'site_name', label: 'Site' },
    ],
    dateColumn: 's.shift_date',
    defaultColumns: [
      'shift_date',
      'employee_name',
      'attendance_status',
      'shift_status',
      'clock_in_datetime',
      'clock_out_datetime',
      'actual_hours',
      'late_minutes',
    ],
    defaultSort: { direction: 'desc', field: 'shift_date' },
    filterColumns: {
      attendanceStatuses: 'a.attendance_status',
      customer: 'c.customer_name',
      customerId: 'c.id',
      department: 'e.department',
      employee: 'e.employee_name',
      employeeId: 'e.id',
      position: 'e.position',
      site: 'st.site_name',
      siteId: 'st.id',
      statuses: 's.shift_status',
    },
    label: 'Attendance Records',
    searchColumns: ['e.employee_name', 'a.attendance_status', 's.shift_status', 'c.customer_name', 'st.site_name'],
  },
  customers: {
    baseSql: 'FROM customers c',
    columns: [
      { expression: 'c.id', key: 'id', label: 'ID' },
      { expression: 'c.customer_code', key: 'customer_code', label: 'Customer Code' },
      { expression: 'c.customer_name', key: 'customer_name', label: 'Customer Name' },
      { expression: 'c.industry', key: 'industry', label: 'Industry' },
      { expression: 'CASE WHEN c.is_active = 1 THEN "Active" ELSE "Inactive" END', key: 'status', label: 'Status' },
      { expression: 'c.created_at', key: 'created_at', label: 'Created At' },
    ],
    defaultColumns: ['customer_code', 'customer_name', 'industry', 'status'],
    defaultSort: { direction: 'asc', field: 'customer_name' },
    filterColumns: {
      customer: 'c.customer_name',
      customerId: 'c.id',
      customerCode: 'c.customer_code',
      industry: 'c.industry',
      isActive: 'c.is_active',
    },
    label: 'Customers',
    searchColumns: ['c.customer_code', 'c.customer_name', 'c.industry'],
  },
  employees: {
    baseSql: 'FROM employees e',
    columns: [
      { expression: 'e.id', key: 'id', label: 'ID' },
      { expression: 'e.employee_code', key: 'employee_code', label: 'Employee Code' },
      { expression: 'e.employee_name', key: 'employee_name', label: 'Employee Name' },
      { expression: 'e.email', key: 'email', label: 'Email' },
      { expression: 'e.department', key: 'department', label: 'Department' },
      { expression: 'e.position', key: 'position', label: 'Position' },
      { expression: 'e.hourly_pay_rate', format: currencyFormat, key: 'hourly_pay_rate', label: 'Hourly Pay Rate' },
      { expression: 'CASE WHEN e.is_active = 1 THEN "Active" ELSE "Inactive" END', key: 'status', label: 'Status' },
      { expression: 'e.created_at', key: 'created_at', label: 'Created At' },
    ],
    defaultColumns: ['employee_code', 'employee_name', 'email', 'department', 'position', 'status'],
    defaultSort: { direction: 'asc', field: 'employee_name' },
    filterColumns: {
      department: 'e.department',
      employee: 'e.employee_name',
      employeeCode: 'e.employee_code',
      employeeId: 'e.id',
      isActive: 'e.is_active',
      position: 'e.position',
    },
    label: 'Employees',
    searchColumns: ['e.employee_code', 'e.employee_name', 'e.email', 'e.department', 'e.position'],
  },
  shifts: {
    baseSql: `
      FROM shifts s
      LEFT JOIN employees e ON e.id = s.employee_id
      JOIN customers c ON c.id = s.customer_id
      JOIN sites st ON st.id = s.site_id
    `,
    columns: [
      { expression: 's.id', key: 'shift_id', label: 'Shift ID' },
      { expression: 's.shift_date', format: dateFormat, key: 'shift_date', label: 'Shift Date' },
      { expression: 's.shift_status', key: 'shift_status', label: 'Shift Status' },
      { expression: 'e.employee_name', key: 'employee_name', label: 'Employee' },
      { expression: 'c.customer_name', key: 'customer_name', label: 'Customer' },
      { expression: 'st.site_name', key: 'site_name', label: 'Site' },
      { expression: 's.scheduled_start', key: 'scheduled_start', label: 'Scheduled Start' },
      { expression: 's.scheduled_end', key: 'scheduled_end', label: 'Scheduled End' },
      { expression: 's.pay_rate', format: currencyFormat, key: 'pay_rate', label: 'Pay Rate' },
      { expression: 's.charge_rate', format: currencyFormat, key: 'charge_rate', label: 'Charge Rate' },
    ],
    dateColumn: 's.shift_date',
    defaultColumns: ['shift_date', 'shift_status', 'employee_name', 'customer_name', 'site_name', 'scheduled_start', 'scheduled_end'],
    defaultSort: { direction: 'desc', field: 'shift_date' },
    filterColumns: {
      customer: 'c.customer_name',
      customerId: 'c.id',
      department: 'e.department',
      employee: 'e.employee_name',
      employeeId: 'e.id',
      position: 'e.position',
      site: 'st.site_name',
      siteId: 'st.id',
      statuses: 's.shift_status',
    },
    label: 'Shifts',
    searchColumns: ['s.shift_status', 'e.employee_name', 'c.customer_name', 'st.site_name'],
  },
  sites: {
    baseSql: `
      FROM sites st
      JOIN customers c ON c.id = st.customer_id
    `,
    columns: [
      { expression: 'st.id', key: 'id', label: 'ID' },
      { expression: 'st.site_code', key: 'site_code', label: 'Site Code' },
      { expression: 'st.site_name', key: 'site_name', label: 'Site Name' },
      { expression: 'c.customer_name', key: 'customer_name', label: 'Customer' },
      { expression: 'st.address', key: 'address', label: 'Address' },
      { expression: 'st.city', key: 'city', label: 'City' },
      { expression: 'CASE WHEN st.is_active = 1 THEN "Active" ELSE "Inactive" END', key: 'status', label: 'Status' },
      { expression: 'st.latitude', format: numberFormat, key: 'latitude', label: 'Latitude' },
      { expression: 'st.longitude', format: numberFormat, key: 'longitude', label: 'Longitude' },
    ],
    defaultColumns: ['site_code', 'site_name', 'customer_name', 'address', 'city', 'status'],
    defaultSort: { direction: 'asc', field: 'site_name' },
    filterColumns: {
      city: 'st.city',
      customer: 'c.customer_name',
      customerId: 'c.id',
      isActive: 'st.is_active',
      site: 'st.site_name',
      siteCode: 'st.site_code',
      siteId: 'st.id',
    },
    label: 'Sites',
    searchColumns: ['st.site_code', 'st.site_name', 'st.address', 'st.city', 'c.customer_name'],
  },
}

export const DATA_LOOKUP_ENTITY_KEYS = Object.keys(DATA_LOOKUP_ENTITIES)

export function getDataLookupEntity(entity) {
  return DATA_LOOKUP_ENTITIES[entity] ?? null
}

export function listDataLookupEntities() {
  return Object.entries(DATA_LOOKUP_ENTITIES).map(([entity, definition]) => ({
    columns: definition.columns.map((column) => column.key),
    defaultColumns: definition.defaultColumns,
    entity,
    filters: Object.keys(definition.filterColumns),
    label: definition.label,
  }))
}
