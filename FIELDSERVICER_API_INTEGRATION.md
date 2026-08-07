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

Roster statuses are mapped into analytics categories so reports have stable group names:

- `Clocked-In`, `Clocked-Out`, `Approved`, `Accepted` -> `Completed`
- `Submitted`, `Published`, `Pending` -> `Scheduled`
- `Unpublish`, `UnAssigned` -> `Unfilled`
- `Rejected` -> `Missed`
- `Deleted` -> `Cancelled`

The raw status is retained alongside the normalized analytics status.

## Adding more endpoints

Register new endpoints in `backend/src/services/api/apiRegistry.js`. For every endpoint:

1. Confirm the HTTP method, path, parameters, and response shape.
2. Add specific natural-language keywords.
3. Add parameter extraction when required.
4. Normalize the response into fields used by the report engine.
5. Verify authentication failures, empty responses, malformed records, and date boundaries.

See `HOW_TO_ADD_NEW_APIS.md` for the registry format and routing examples.

## Health and troubleshooting

Use `GET /api/health/fieldservicer` to verify authentication and connectivity.

- Authentication failure: verify credentials and `FIELDSERVICER_FOR_PORTAL`.
- Repeated `401`: inspect access-token parsing and the login response shape.
- Empty roster: verify location, client, and date-range parameters.
- Unexpected analytics: compare the live response fields with the normalization logic in `report.repository.js`.
