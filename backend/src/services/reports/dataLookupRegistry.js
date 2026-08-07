const COMMON_FILTERS = [
  'attendanceStatuses',
  'customer',
  'customerId',
  'department',
  'employee',
  'employeeId',
  'position',
  'site',
  'siteId',
  'statuses',
  'statusIds',
]

export const DATA_LOOKUP_ENTITIES = {
  attendance: {
    columns: [
      'shift_date',
      'employee_name',
      'status_id',
      'raw_status',
      'attendance_status',
      'shift_status',
      'scheduled_start',
      'scheduled_end',
      'actual_hours',
    ],
    defaultColumns: [
      'shift_date',
      'employee_name',
      'status_id',
      'raw_status',
      'attendance_status',
      'shift_status',
      'scheduled_start',
      'scheduled_end',
      'actual_hours',
    ],
    filters: COMMON_FILTERS,
    label: 'Attendance Records',
  },
  employees: {
    columns: ['employee_name', 'department', 'position', 'status'],
    defaultColumns: ['employee_name', 'department', 'position', 'status'],
    filters: ['department', 'employee', 'employeeId', 'position'],
    label: 'Employees',
  },
  shifts: {
    columns: [
      'shift_date',
      'status_id',
      'raw_status',
      'shift_status',
      'employee_name',
      'customer_name',
      'site_name',
      'scheduled_start',
      'scheduled_end',
    ],
    defaultColumns: [
      'shift_date',
      'status_id',
      'raw_status',
      'shift_status',
      'employee_name',
      'customer_name',
      'site_name',
      'scheduled_start',
      'scheduled_end',
    ],
    filters: COMMON_FILTERS,
    label: 'Shifts',
  },
  sites: {
    columns: ['site_name', 'customer_name'],
    defaultColumns: ['site_name', 'customer_name'],
    filters: ['customer', 'customerId', 'site', 'siteId'],
    label: 'Sites',
  },
  customers: {
    columns: ['customer_name'],
    defaultColumns: ['customer_name'],
    filters: ['customer', 'customerId'],
    label: 'Customers',
  },
}

export const DATA_LOOKUP_ENTITY_KEYS = Object.keys(DATA_LOOKUP_ENTITIES)

export function getDataLookupEntity(entity) {
  return DATA_LOOKUP_ENTITIES[entity] ?? null
}

export function listDataLookupEntities() {
  return Object.entries(DATA_LOOKUP_ENTITIES).map(([entity, definition]) => ({
    columns: definition.columns,
    defaultColumns: definition.defaultColumns,
    entity,
    filters: definition.filters,
    label: definition.label,
  }))
}
