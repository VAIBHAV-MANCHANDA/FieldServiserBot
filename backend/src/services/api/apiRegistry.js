/**
 * API Registry - Centralized catalog of all FieldServicer API endpoints
 * This makes it easy to add new APIs without changing core logic
 */

export const apiRegistry = {
  // Authentication APIs
  auth: {
    login: {
      method: 'POST',
      endpoint: '/Auth/Login',
      description: 'Authenticate user and get JWT tokens',
      params: ['Username', 'Password', 'ForPortal', 'ForLMS'],
      keywords: ['login', 'authenticate', 'signin', 'sign in'],
      requiresAuth: false,
    },
  },

  // Shift/Roster APIs
  shifts: {
    rosterList: {
      method: 'GET',
      endpoint: '/Shift/RosterShiftList',
      description: 'Get roster shift list with filters',
      params: ['LocationID', 'ClientID', 'FromDate', 'ToDate'],
      keywords: ['roster', 'shift', 'shifts', 'schedule', 'rota', 'work schedule'],
      requiresAuth: true,
    },
    // Add more shift endpoints as discovered
    // shiftDetails: { ... },
    // updateShift: { ... },
  },

  // Employee APIs (to be added)
  employees: {
    list: {
      method: 'GET',
      endpoint: '/Employee/List',
      description: 'Get list of employees',
      params: ['LocationID', 'DepartmentID'],
      keywords: ['employee', 'employees', 'staff', 'workers', 'team members'],
      requiresAuth: true,
    },
    // details: { ... },
    // create: { ... },
  },

  // Attendance APIs (to be added)
  attendance: {
    clockIn: {
      method: 'POST',
      endpoint: '/Attendance/ClockIn',
      description: 'Clock in employee',
      params: ['EmployeeID', 'LocationID', 'Timestamp'],
      keywords: ['clock in', 'check in', 'punch in', 'start shift'],
      requiresAuth: true,
    },
    clockOut: {
      method: 'POST',
      endpoint: '/Attendance/ClockOut',
      description: 'Clock out employee',
      params: ['EmployeeID', 'LocationID', 'Timestamp'],
      keywords: ['clock out', 'check out', 'punch out', 'end shift'],
      requiresAuth: true,
    },
    // history: { ... },
  },

  // Location APIs (to be added)
  locations: {
    list: {
      method: 'GET',
      endpoint: '/Location/List',
      description: 'Get list of locations',
      params: [],
      keywords: ['location', 'locations', 'site', 'sites', 'office', 'branch'],
      requiresAuth: true,
    },
  },

  // Client APIs (to be added)
  clients: {
    list: {
      method: 'GET',
      endpoint: '/Client/List',
      description: 'Get list of clients',
      params: [],
      keywords: ['client', 'clients', 'customer', 'customers', 'company', 'companies'],
      requiresAuth: true,
    },
  },

  // Reports APIs (to be added)
  reports: {
    attendance: {
      method: 'GET',
      endpoint: '/Report/Attendance',
      description: 'Get attendance report',
      params: ['FromDate', 'ToDate', 'EmployeeID', 'LocationID'],
      keywords: ['attendance report', 'attendance summary', 'who worked', 'work hours'],
      requiresAuth: true,
    },
  },
}

/**
 * Get all API definitions in a flat structure
 */
export function getAllApis() {
  const apis = []
  
  for (const [category, endpoints] of Object.entries(apiRegistry)) {
    for (const [name, config] of Object.entries(endpoints)) {
      apis.push({
        category,
        name,
        ...config,
      })
    }
  }
  
  return apis
}

/**
 * Find API by keywords/intent
 */
export function findApiByKeywords(query) {
  const normalizedQuery = query.toLowerCase()
  const allApis = getAllApis()
  
  // Score each API based on keyword matches
  const matches = allApis.map(api => {
    let score = 0
    
    // Check if any keyword matches
    for (const keyword of api.keywords) {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        score += keyword.split(' ').length // Multi-word keywords score higher
      }
    }
    
    // Boost if description matches
    if (api.description && normalizedQuery.includes(api.description.toLowerCase())) {
      score += 2
    }
    
    return { api, score }
  })
  
  // Filter and sort by score
  const results = matches
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
  
  return results.length > 0 ? results : null
}

/**
 * Get API definition by category and name
 */
export function getApi(category, name) {
  return apiRegistry[category]?.[name] || null
}

/**
 * Register a new API dynamically (for future extensibility)
 */
export function registerApi(category, name, config) {
  if (!apiRegistry[category]) {
    apiRegistry[category] = {}
  }
  
  apiRegistry[category][name] = config
}

/**
 * Get formatted API catalog for AI context
 */
export function getApiCatalog() {
  const allApis = getAllApis()
  
  return allApis.map(api => ({
    name: `${api.category}.${api.name}`,
    method: api.method,
    endpoint: api.endpoint,
    description: api.description,
    params: api.params,
    keywords: api.keywords.join(', '),
  }))
}
