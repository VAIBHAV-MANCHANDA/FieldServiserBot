# FieldServicer Bot

FieldServicer Bot is a JavaScript full-stack application for exploring live workforce data with natural-language questions. React sends questions to Express, Gemini converts them into structured report intents, Joi validates those intents, and the backend retrieves and aggregates real data from the FieldServicer API.

## Architecture

- `frontend`: React, Vite, Axios, React Router, and Recharts.
- `backend`: Node.js, Express, Gemini, Joi, and an authenticated FieldServicer API client.
- `FieldServicer API`: the only workforce data source.

Gemini receives workforce questions and report context, but it never receives FieldServicer credentials. The backend owns authentication, intent validation, API access, normalization, filtering, aggregation, chart configuration, result limits, and error handling.

Chat sessions are held in backend memory for the lifetime of the running process.

## Requirements

- Node.js 20+
- FieldServicer API credentials
- Gemini API key for natural-language tool selection and grounded answers

## Backend setup

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Configure `backend/.env`:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

FIELDSERVICER_API_URL=https://app.fieldservicer.com/api
FIELDSERVICER_USERNAME=your-email@example.com
FIELDSERVICER_PASSWORD=your-password
FIELDSERVICER_FOR_PORTAL=true
FIELDSERVICER_CACHE_TTL_MS=30000

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite

MAX_REPORT_DATE_RANGE_DAYS=366
MAX_REPORT_ROWS=100
```

Keep credentials only in `backend/.env`; never expose them through frontend environment variables or commit them.

## Frontend setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Configure `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Application endpoints

- `GET /api/health`
- `GET /api/health/fieldservicer`
- `POST /api/auth/login`
- `POST /api/chat/query`
- `GET /api/chat/history`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:sessionId`
- `DELETE /api/chat/sessions/:sessionId`
- `GET /api/reports/types`
- `GET /api/reports/dashboard?days=30`
- `POST /api/reports/generate`

## FieldServicer endpoints currently used

- `POST /Auth/Login`
- `GET /Shift/RosterShiftList`

The roster endpoint accepts `LocationID`, `ClientID`, `FromDate`, and `ToDate`. Its response is normalized into a stable internal shift shape before reports are calculated.

The dashboard endpoint accepts `days=7`, `days=30`, or `days=90`. It makes one roster request covering the selected and previous comparison periods, then derives every dashboard KPI, chart, employee comparison, site comparison, live roster item, and operational-risk indicator in memory. Identical roster requests are cached briefly and concurrent duplicates share the same in-flight request.

## Query workflow

1. The frontend posts a workforce question to `/api/chat/query`.
2. The backend gives Gemini a fixed catalog of API-backed workforce functions.
3. Gemini corrects obvious typos, interprets follow-ups, and selects one function with structured arguments.
4. Joi and tool-specific allowlists validate every date, filter, metric, grouping, status ID, sort field, and result limit.
5. The selected backend function requests live records from FieldServicer; Gemini cannot supply an endpoint or execute arbitrary code.
6. Records are normalized, filtered, grouped, and aggregated in memory.
7. The function result is returned to Gemini, which produces an answer grounded strictly in the returned rows.
8. Low-confidence selections, fallbacks, and empty results are emitted as structured `query_miss` logs for review.

## Example questions

- Show completed and missed shifts this month.
- Create a graph of actual hours by employee.
- Which site has the most missed shifts?
- Show currently clocked-in employees.
- Compare rostered and actual hours.
- Show the shift-status distribution as a pie chart.

Follow-ups can reuse the previous intent:

- Group this by week.
- Compare it with last month.
- Show the top five only.
- Convert this into a line graph.

## Adding a Gemini workforce tool

1. Add a function declaration to `backend/src/tools/workforce.tools.js`. Give it a distinct name, a precise description, and only the arguments the backend supports.
2. Add its fixed mapping and argument allowlists to `backend/src/services/ai/workforceTool.service.js`.
3. Implement or register the corresponding repository method. All external access must remain inside the authenticated FieldServicer client.
4. Add the report definition and real API-supported metrics to `backend/src/services/reports/reportRegistry.js`.
5. Add tests for correct selection, malformed arguments, empty results, and ambiguous wording.

Do not add keyword lists, raw URLs supplied by Gemini, SQL generation, or values that are not present in the FieldServicer response. See `HOW_TO_ADD_NEW_APIS.md` for the complete workflow.

## Troubleshooting

- If `/api/health/fieldservicer` fails, verify the FieldServicer URL, credentials, portal flag, and network access.
- If Gemini is unavailable, the backend returns the closest safe API-backed fallback and records a `query_miss`; configure `GEMINI_API_KEY` for intelligent routing.
- If the frontend cannot reach the backend, confirm `VITE_API_BASE_URL=http://localhost:5000/api`.
- Check backend logs for authentication, routing, normalization, and upstream API errors.
