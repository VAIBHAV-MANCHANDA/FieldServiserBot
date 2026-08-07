const DATE_RANGE_LABELS = [
  'today',
  'yesterday',
  'this week',
  'last week',
  'this month',
  'last month',
  'last 30 days',
  'last 6 months',
]

export const WORKFORCE_TOOL_NAMES = [
  'lookup_roster_records',
  'get_shift_status_summary',
  'compare_employee_shifts',
  'compare_employee_hours',
  'get_currently_clocked_in',
  'get_attendance_records',
  'get_shift_trend',
  'compare_site_coverage',
  'compare_customer_shifts',
]

const dateProperties = {
  date_range: {
    description: 'Relative date range. Use this unless the user supplied exact dates.',
    enum: DATE_RANGE_LABELS,
    type: 'string',
  },
  from_date: {
    description: 'Inclusive start date as YYYY-MM-DD. Set together with to_date only for an explicit range.',
    type: 'string',
  },
  to_date: {
    description: 'Inclusive end date as YYYY-MM-DD. Set together with from_date only for an explicit range.',
    type: 'string',
  },
}

const filterProperties = {
  customer: { description: 'Exact or closest customer/supplier name mentioned by the user.', type: 'string' },
  customer_id: { description: 'Numeric FieldServicer client ID when explicitly known.', type: 'integer' },
  employee: { description: 'Exact or closest employee name mentioned by the user.', type: 'string' },
  employee_id: { description: 'Numeric FieldServicer employee ID when explicitly known.', type: 'integer' },
  site: { description: 'Exact or closest FieldServicer location name mentioned by the user.', type: 'string' },
  site_id: { description: 'Numeric FieldServicer LocationID when explicitly known.', type: 'integer' },
  status_ids: {
    description: 'FieldServicer StatusIDs to include. 3 is Clocked-In; 4 and 12 are Clocked-Out.',
    items: { enum: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12], type: 'integer' },
    type: 'array',
  },
}

const selectionProperties = {
  assumption: {
    description: 'Briefly state any assumption made for an ambiguous query. Omit when no assumption was needed.',
    type: 'string',
  },
  confidence: {
    description: 'Your confidence from 0 to 1 that this is the best tool for the user request.',
    maximum: 1,
    minimum: 0,
    type: 'number',
  },
  understood_query: {
    description: 'A concise plain-English interpretation of what the user requested.',
    type: 'string',
  },
}

const commonProperties = {
  ...dateProperties,
  ...filterProperties,
  ...selectionProperties,
  chart_type: {
    description: 'Best visualization for the requested comparison.',
    enum: ['bar', 'line', 'pie'],
    type: 'string',
  },
  limit: { description: 'Maximum groups or records to return, from 1 to 100.', maximum: 100, minimum: 1, type: 'integer' },
}

function declaration(name, description, properties, required = []) {
  return {
    description,
    name,
    parametersJsonSchema: {
      properties: { ...properties, ...selectionProperties },
      required: [...new Set([...required, 'confidence', 'understood_query'])],
      type: 'object',
    },
  }
}

export const WORKFORCE_TOOL_DECLARATIONS = [
  declaration(
    'lookup_roster_records',
    'Use for direct record browsing or searching: list/show/find raw shifts, roster-derived employees, sites, or customers. Do not use for comparisons, rankings, totals, trends, or performance questions.',
    {
      ...commonProperties,
      entity: { enum: ['shifts', 'employees', 'sites', 'customers'], type: 'string' },
      search: { description: 'Name or text to find within the selected record type.', type: 'string' },
    },
    ['entity'],
  ),
  declaration(
    'get_shift_status_summary',
    'Use for totals or distributions of roster statuses, including published, scheduled, completed, missed, rejected, deleted, unassigned, Clocked-In, or Clocked-Out shifts.',
    {
      ...commonProperties,
      group_by: { enum: ['shift_status', 'date', 'week', 'month', 'employee', 'site', 'customer'], type: 'string' },
      metrics: {
        items: { enum: ['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'cancelled_count', 'completion_rate', 'fill_rate'], type: 'string' },
        type: 'array',
      },
    },
  ),
  declaration(
    'compare_employee_shifts',
    'Use for employee rankings or comparisons by shift count and outcomes, such as who worked, completed, or missed the most or fewest shifts.',
    {
      ...commonProperties,
      metrics: {
        items: { enum: ['shift_count', 'completed_count', 'missed_count'], type: 'string' },
        type: 'array',
      },
      sort_direction: { enum: ['asc', 'desc'], type: 'string' },
      sort_field: { enum: ['shift_count', 'completed_count', 'missed_count'], type: 'string' },
    },
  ),
  declaration(
    'compare_employee_hours',
    'Use for comparing employee rostered hours or hours represented by worked FieldServicer statuses. Do not claim precise clock-duration or overtime data because the roster API does not provide clock timestamps.',
    {
      ...commonProperties,
      metrics: { items: { enum: ['rostered_hours', 'actual_hours'], type: 'string' }, type: 'array' },
      sort_direction: { enum: ['asc', 'desc'], type: 'string' },
      sort_field: { enum: ['rostered_hours', 'actual_hours'], type: 'string' },
    },
  ),
  declaration(
    'get_currently_clocked_in',
    'Use only when the user asks who is currently clocked in or requests live Clocked-In status. This maps to FieldServicer StatusID 3.',
    commonProperties,
  ),
  declaration(
    'get_attendance_records',
    'Use for clock-in, clock-out, or attendance record details. StatusID 3 is Clocked-In, and StatusIDs 4 and 12 are Clocked-Out.',
    {
      ...commonProperties,
      attendance_statuses: {
        items: { enum: ['Clocked In', 'Clocked Out', 'Completed', 'Missed', 'Not Started', 'Unfilled', 'Cancelled'], type: 'string' },
        type: 'array',
      },
      search: { description: 'Employee or other roster text to find.', type: 'string' },
    },
  ),
  declaration(
    'get_shift_trend',
    'Use for changes over time, trends, period comparisons, weekly/monthly patterns, or time-series charts of shift volume and outcomes.',
    {
      ...commonProperties,
      group_by: { enum: ['date', 'week', 'month'], type: 'string' },
      metrics: {
        items: { enum: ['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'fill_rate'], type: 'string' },
        type: 'array',
      },
    },
  ),
  declaration(
    'compare_site_coverage',
    'Use for comparing FieldServicer sites/locations by coverage, shift volume, completed, missed, or unfilled shifts. Do not use for financial performance.',
    {
      ...commonProperties,
      metrics: {
        items: { enum: ['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'fill_rate', 'rostered_hours', 'actual_hours'], type: 'string' },
        type: 'array',
      },
      sort_direction: { enum: ['asc', 'desc'], type: 'string' },
      sort_field: { enum: ['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'fill_rate', 'rostered_hours', 'actual_hours'], type: 'string' },
    },
  ),
  declaration(
    'compare_customer_shifts',
    'Use for comparing customers/suppliers by roster coverage and shift outcomes. Only workforce metrics are available; never infer revenue, wages, or profit.',
    {
      ...commonProperties,
      metrics: {
        items: { enum: ['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'fill_rate', 'rostered_hours', 'actual_hours'], type: 'string' },
        type: 'array',
      },
      sort_direction: { enum: ['asc', 'desc'], type: 'string' },
      sort_field: { enum: ['shift_count', 'completed_count', 'missed_count', 'unfilled_count', 'fill_rate', 'rostered_hours', 'actual_hours'], type: 'string' },
    },
  ),
]

export const WORKFORCE_TOOL_NAME_SET = new Set(WORKFORCE_TOOL_NAMES)
