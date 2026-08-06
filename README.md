# AI Workforce Analytics C

AI Workforce Analytics C is a JavaScript-only full-stack app for asking natural-language workforce analytics questions. React sends the question to Express, Gemini converts it into a structured reporting intent, Joi validates it, and the backend runs only approved parameterized MySQL reports.

## Architecture

React + Vite + Axios + Recharts runs in `frontend`. Node.js + Express + ES modules runs in `backend`. MySQL stores employees, customers, sites, shifts, attendance, chat sessions, chat messages, and AI query logs.

Gemini never receives database credentials and never generates executable SQL. It only returns structured JSON intent. The backend owns validation, report selection, SQL, parameter binding, chart configuration, summary cards, error handling, and row/date limits.

## Requirements

- Node.js 20+
- MySQL 8+
- Gemini API key for chat queries

## MySQL Setup

Create the database and schema in this order:

```bash
mysql -u root -p < database/01-create-database.sql
mysql -u root -p workforce_ai < database/02-create-tables.sql
mysql -u root -p workforce_ai < database/03-create-indexes.sql
mysql -u root -p workforce_ai < database/04-create-views.sql
```

The database name defaults to `workforce_ai` and can be changed with `DB_NAME`.

## Backend Setup

```bash
cd backend
npm install
copy .env.example .env
npm run seed
npm run dev
```

Required backend environment variables:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=workforce_ai
DB_CONNECTION_LIMIT=10
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
MAX_REPORT_DATE_RANGE_DAYS=366
MAX_REPORT_ROWS=100
```

Get a Gemini API key from Google AI Studio, then place it only in `backend/.env` as `GEMINI_API_KEY`. Do not put it in `frontend/.env`.

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend environment:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Seed Data

Run:

```bash
cd backend
npm run seed
```

The seed script is idempotent and generates approximately 25 employees, 6 customers, 12 sites, 1,500 shifts, and 1,300+ attendance records over the last six months.

## API Endpoints

- `GET /api/health`
- `GET /api/health/database`
- `POST /api/chat/query`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:sessionId`
- `DELETE /api/chat/sessions/:sessionId`
- `GET /api/reports/types`
- `POST /api/reports/generate`

## Example Questions

- Show completed and missed shifts this month.
- Create a graph of actual hours by employee.
- Which employees were late most frequently?
- Show revenue, wages and gross profit by month.
- Which site has the most missed shifts?
- Show currently clocked-in employees.
- Compare rostered and actual hours.
- Show the shift-status distribution as a pie chart.

Follow-ups:

- Group this by week.
- Compare it with last month.
- Show the top five only.
- Convert this into a line graph.

## Security Design

- Gemini only returns structured JSON intent.
- Joi validates report type, metrics, grouping, filters, sort, chart type, and limits.
- SQL lives in repositories and uses placeholders.
- AI-generated raw SQL is never executed.
- Chat attempts are logged without credentials.
- The Gemini key stays in backend `.env`.

## Troubleshooting

- If `GET /api/health/database` fails, confirm MySQL is running and `backend/.env` credentials match.
- If `POST /api/chat/query` returns `GEMINI_NOT_CONFIGURED`, add `GEMINI_API_KEY`.
- If seeding fails, rerun the SQL migration files in order and then run `npm run seed`.
- If the frontend cannot reach the API, confirm `VITE_API_BASE_URL=http://localhost:5000/api`.
