# How to Add New FieldServicer APIs

## Overview

With 100+ APIs available, we've built a **dynamic API routing system** that automatically determines which API to call based on natural language queries. Adding a new API takes just 1-2 minutes.

## Architecture

```
User Query → API Registry (keyword match) → AI Router (if ambiguous) → FieldServicer Client → Real API
```

### Components:

1. **API Registry** (`src/services/api/apiRegistry.js`)
   - Centralized catalog of all available APIs
   - Keyword mappings for fast routing
   - Parameter definitions

2. **API Router** (`src/services/api/apiRouter.service.js`)
   - Smart routing logic (keyword + AI)
   - Parameter extraction from natural language
   - Executes API calls

3. **FieldServicer Client** (`src/config/fieldservicer.js`)
   - Handles authentication
   - Auto token refresh
   - HTTP methods (GET, POST, etc.)

## How to Add a New API

### Step 1: Discover the API Endpoint

Find the endpoint details:
- **Method**: GET, POST, PUT, DELETE
- **Path**: `/Employee/List`, `/Attendance/ClockIn`, etc.
- **Parameters**: Required and optional params
- **Purpose**: What does it do?

### Step 2: Add to API Registry

Open `backend/src/services/api/apiRegistry.js` and add your endpoint:

```javascript
export const apiRegistry = {
  // ... existing categories ...

  // Add new category or extend existing one
  employees: {
    list: {
      method: 'GET',
      endpoint: '/Employee/List',
      description: 'Get list of all employees',
      params: ['LocationID', 'DepartmentID'],
      keywords: ['employee', 'employees', 'staff', 'workers', 'team members'],
      requiresAuth: true,
    },
    
    // ADD YOUR NEW API HERE
    details: {
      method: 'GET',
      endpoint: '/Employee/Details',
      description: 'Get detailed employee information',
      params: ['EmployeeID'],
      keywords: ['employee details', 'employee info', 'employee profile', 'staff details'],
      requiresAuth: true,
    },
  },
}
```

### Step 3: Test It

That's it! The system will now automatically:
- Match queries containing your keywords
- Extract parameters from natural language
- Call the endpoint with correct authentication

#### Test in Code:

```javascript
import { routeQuery, executeApiCall } from './services/api/apiRouter.service.js'

// Test routing
const route = await routeQuery('show employee details for employee 123')
console.log(route)
// → { api: { ... }, params: { EmployeeID: 123 }, confidence: 'high' }

// Execute the API call
const result = await executeApiCall(route)
console.log(result)
// → { success: true, data: {...}, meta: {...} }
```

## Real Examples

### Example 1: Add Time Off API

```javascript
timeOff: {
  request: {
    method: 'POST',
    endpoint: '/TimeOff/Request',
    description: 'Submit time off request',
    params: ['EmployeeID', 'FromDate', 'ToDate', 'Reason'],
    keywords: ['time off', 'leave request', 'vacation request', 'request leave', 'pto'],
    requiresAuth: true,
  },
  
  history: {
    method: 'GET',
    endpoint: '/TimeOff/History',
    description: 'Get time off history',
    params: ['EmployeeID', 'FromDate', 'ToDate'],
    keywords: ['time off history', 'leave history', 'vacation history', 'pto history'],
    requiresAuth: true,
  },
},
```

**Queries that will work:**
- "show time off history for this month"
- "request time off for employee 456 from 2026-08-15 to 2026-08-20"
- "what's my vacation history"

### Example 2: Add Department API

```javascript
departments: {
  list: {
    method: 'GET',
    endpoint: '/Department/List',
    description: 'Get list of departments',
    params: [],
    keywords: ['department', 'departments', 'department list', 'all departments'],
    requiresAuth: true,
  },
  
  create: {
    method: 'POST',
    endpoint: '/Department/Create',
    description: 'Create new department',
    params: ['DepartmentName', 'ManagerID'],
    keywords: ['create department', 'new department', 'add department'],
    requiresAuth: true,
  },
},
```

### Example 3: Add Report API

```javascript
reports: {
  attendance: {
    method: 'GET',
    endpoint: '/Report/AttendanceDetail',
    description: 'Get detailed attendance report',
    params: ['FromDate', 'ToDate', 'EmployeeID', 'LocationID'],
    keywords: ['attendance report', 'attendance detail', 'attendance summary', 'who worked'],
    requiresAuth: true,
  },
  
  payroll: {
    method: 'GET',
    endpoint: '/Report/Payroll',
    description: 'Get payroll report',
    params: ['FromDate', 'ToDate', 'DepartmentID'],
    keywords: ['payroll report', 'payroll summary', 'salary report', 'wages report'],
    requiresAuth: true,
  },
},
```

## Parameter Auto-Extraction

The system automatically extracts these parameters from natural language:

| Parameter | Examples | Auto-extracted from |
|-----------|----------|-------------------|
| `FromDate`, `ToDate` | "this month", "last week", "today" | Date phrases |
| `LocationID` | "location 5", "location id: 12" | Number patterns |
| `ClientID` | "client 3", "client: 8" | Number patterns |
| `EmployeeID` | "employee 123", "employee: 456" | Number patterns |

### Adding Custom Parameter Extraction

If you need to extract other parameters, update `extractParams()` in `apiRouter.service.js`:

```javascript
function extractParams(query, api, context) {
  const params = {}
  
  // ... existing extractions ...
  
  // Add custom extraction
  if (api.params.includes('DepartmentID')) {
    params.DepartmentID = extractId(query, 'department') ?? context.departmentId ?? null
  }
  
  if (api.params.includes('Reason')) {
    // Extract text after "reason:" or "because"
    const match = query.match(/(?:reason|because)[:\s]+([^.!?]+)/i)
    params.Reason = match ? match[1].trim() : null
  }
  
  return params
}
```

## Best Practices

### 1. Choose Good Keywords

✅ **Good**: `['clock in', 'check in', 'punch in', 'start shift']`  
❌ **Bad**: `['in', 'start', 'go']` (too generic)

### 2. Add Multi-word Keywords

Multi-word keywords score higher in matching:
```javascript
keywords: ['attendance report', 'attendance detail', 'time sheet']
// Better than: ['attendance', 'report', 'detail']
```

### 3. Group Related APIs

```javascript
// Good organization
attendance: {
  clockIn: { ... },
  clockOut: { ... },
  history: { ... },
}

// vs scattered
clockIn: { ... },  // in different places
clockOut: { ... },
```

### 4. Include Synonyms

```javascript
keywords: [
  'employee', 'employees',
  'staff', 'worker', 'workers',
  'team member', 'team members'
]
```

## Testing New APIs

### 1. Unit Test API Routing

```javascript
import { routeQuery } from './services/api/apiRouter.service.js'

// Test different queries
const queries = [
  'show employee list',
  'clock in for employee 123',
  'attendance report for this month',
]

for (const query of queries) {
  const route = await routeQuery(query)
  console.log(query, '→', route.api.endpoint, route.confidence)
}
```

### 2. Test API Execution

```bash
node backend/test-api.js
```

### 3. Test in Chat Interface

Just ask natural language questions in the chat:
- "Show me all employees"
- "What's the roster for this week?"
- "Clock in employee 456"

## Advanced: Dynamic API Registration

You can add APIs at runtime:

```javascript
import { registerApi } from './services/api/apiRegistry.js'

// Dynamically add an API
registerApi('notifications', 'send', {
  method: 'POST',
  endpoint: '/Notification/Send',
  description: 'Send notification to users',
  params: ['UserID', 'Message', 'Type'],
  keywords: ['send notification', 'notify', 'alert user'],
  requiresAuth: true,
})
```

## AI Fallback

If keyword matching fails (confidence < 3), the system uses **Gemini AI** to analyze the query and suggest the best API. This means even complex or ambiguous queries work:

- "I want to know about people who didn't show up last Tuesday"
  → Routes to `/Shift/MissedShifts` or attendance API

- "Give me a breakdown of hours by department"
  → Routes to `/Report/DepartmentHours`

## Monitoring & Debugging

Check logs to see routing decisions:

```javascript
logger.info('Routing API query', { query, method: 'keyword', confidence: 'high' })
logger.info('Executing FieldServicer API call', { endpoint, params })
```

## Summary

To add 100 more APIs:

1. Open `apiRegistry.js`
2. Add each endpoint with keywords
3. Done! 🎉

The system handles everything else:
- Keyword matching
- AI fallback
- Parameter extraction
- Authentication
- Error handling

**Time per API: 1-2 minutes**
