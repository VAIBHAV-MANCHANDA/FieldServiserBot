# FieldServicer API Integration

## Overview

FieldServicer is the application's only workforce data source. The backend authenticates with FieldServicer, retrieves live records, normalizes external response fields, and calculates analytics in memory.

## Configuration

Set these values in `backend/.env`:

```env
FIELDSERVICER_API_URL=https://app.fieldservicer.com/api
FIELDSERVICER_USERNAME=your-email@example.com
FIELDSERVICER_PASSWORD=your-password
FIELDSERVICER_FOR_PORTAL=true
FIELDSERVICER_CACHE_TTL_MS=30000
```

Never commit real credentials. Use environment-specific accounts and rotate credentials regularly.

## Authentication

The shared client in `backend/src/config/fieldservicer.js`:

1. Calls `POST /Auth/Login` with server-side credentials.
2. Holds access and refresh tokens in process memory.
3. reads the access-token expiry and renews it with a one-minute buffer.
4. Adds `Authorization: Bearer <token>` to authenticated requests.
5. Re-authenticates and retries once when FieldServicer returns `401`.

The browser does not need FieldServicer credentials to request analytics from the backend.

Roster responses are cached in process memory for 30 seconds by default. Requests with the same location, client, and date range reuse cached data, while simultaneous identical requests share one upstream call. The dashboard refresh action can explicitly bypass this cache.

## Roster data

The confirmed roster endpoint is:

```text
GET /Shift/RosterShiftList
```

Supported parameters:

- `LocationID`: location filter; `0` means all available locations.
- `ClientID`: client filter; `0` means all available clients.
- `FromDate`: inclusive start date in `YYYY-MM-DD` format.
- `ToDate`: inclusive end date in `YYYY-MM-DD` format.

Example backend usage:

```javascript
const shifts = await fieldServicerClient.getRosterShiftList({
  locationId: 0,
  clientId: 0,
  fromDate: '2026-08-01',
  toDate: '2026-08-31',
})
```

## Data flow

```text
Frontend request
  -> Express controller
  -> validated report intent
  -> FieldServicer client
  -> live API response
  -> response normalization
  -> filtering and aggregation
  -> cards, charts, table, and summary
```

## Status normalization

`StatusID` is the authoritative source for roster status title and display colors:

| StatusID | Title | Background | Text |
| ---: | --- | --- | --- |
| 1 | Unpublish | `#fff4b3` | Black |
| 2 | Published | `#fffe42` | Black |
| 3 | Clocked-In | `#23d06c` | Black |
| 4 | Clocked-Out | `#697390` | Black |
| 5 | Approved | `#9ccf7a` | Black |
| 6 | Rejected | `#e42048` | Black |
| 7 | Deleted | `#ffae42` | Black |
| 9 | UnAssigned | `#ee82ee` | Black |
| 10 | Submitted | `#697390` | Black |
| 11 | Accepted | `#9ccf7a` | Black |
| 12 | Clocked-Out | `#697390` | Black |

The mapped status is then converted into analytics categories so reports have stable group names:

- `Clocked-In`, `Clocked-Out`, `Approved`, `Accepted` -> `Completed`
- `Submitted`, `Published`, `Pending` -> `Scheduled`
- `Unpublish`, `UnAssigned` -> `Unfilled`
- `Rejected` -> `Missed`
- `Deleted` -> `Cancelled`

The raw status is retained alongside the normalized analytics status.

## Adding more endpoints

Add new authenticated request methods to `backend/src/config/fieldservicer.js`. For every endpoint:

1. Confirm the HTTP method, path, parameters, and response shape.
2. Normalize only real response fields into the report engine.
3. Declare a fixed Gemini function in `backend/src/tools/workforce.tools.js` with a precise description and restricted JSON schema.
4. Map and validate that function in `backend/src/services/ai/workforceTool.service.js`.
5. Verify authentication failures, empty responses, malformed arguments, typo-heavy questions, and date boundaries.

See `HOW_TO_ADD_NEW_APIS.md` for the function-calling workflow.

## Health and troubleshooting

Use `GET /api/health/fieldservicer` to verify authentication and connectivity.

- Authentication failure: verify credentials and `FIELDSERVICER_FOR_PORTAL`.
- Repeated `401`: inspect access-token parsing and the login response shape.
- Empty roster: verify location, client, and date-range parameters.
- Unexpected analytics: compare the live response fields with the normalization logic in `report.repository.js`.
