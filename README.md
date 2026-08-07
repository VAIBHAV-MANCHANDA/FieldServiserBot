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
- Gemini API key for questions that cannot be resolved by deterministic intent rules

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

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash

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
- `POST /api/reports/generate`

## FieldServicer endpoints currently used

- `POST /Auth/Login`
- `GET /Shift/RosterShiftList`

The roster endpoint accepts `LocationID`, `ClientID`, `FromDate`, and `ToDate`. Its response is normalized into a stable internal shift shape before reports are calculated.

## Query workflow

1. The frontend posts a workforce question to `/api/chat/query`.
2. The backend rejects unrelated questions and loads recent conversation context.
3. Deterministic rules or Gemini produce a structured report intent.
4. Joi validates the report type, metrics, grouping, filters, dates, sorting, chart type, and row limit.
5. The backend requests live records from FieldServicer.
6. Records are normalized, filtered, grouped, and aggregated in memory.
7. The response includes summary cards, line/pie/bar charts, a table, and a concise explanation.

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

## Adding FieldServicer endpoints

Add endpoint metadata to `backend/src/services/api/apiRegistry.js`, including its method, path, parameters, keywords, and authentication requirement. Add or update normalization and report logic when the endpoint returns a new data shape. See `HOW_TO_ADD_NEW_APIS.md` for examples.

## Troubleshooting

- If `/api/health/fieldservicer` fails, verify the FieldServicer URL, credentials, portal flag, and network access.
- If a chat request returns `GEMINI_NOT_CONFIGURED`, add `GEMINI_API_KEY` or use a question supported by deterministic intent rules.
- If the frontend cannot reach the backend, confirm `VITE_API_BASE_URL=http://localhost:5000/api`.
- Check backend logs for authentication, routing, normalization, and upstream API errors.
