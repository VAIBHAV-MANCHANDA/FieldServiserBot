# FieldServicer API Integration

## Overview

The application now connects to the real **FieldServicer API** instead of using local seed data. All employee, shift, and roster data is fetched from the live API.

## Configuration

### Environment Variables

Update your `backend/.env` file with FieldServicer credentials:

```env
# FieldServicer API Configuration
FIELDSERVICER_API_URL=https://app.fieldservicer.com/api
FIELDSERVICER_USERNAME=your-email@example.com
FIELDSERVICER_PASSWORD=your-password
FIELDSERVICER_FOR_PORTAL=true
```

### Example Configuration

```env
FIELDSERVICER_API_URL=https://app.fieldservicer.com/api
FIELDSERVICER_USERNAME=bhupindersehjal9@outlook.com
FIELDSERVICER_PASSWORD=y34nf9
FIELDSERVICER_FOR_PORTAL=true
```

## Features

### 1. **Automatic JWT Authentication**
- Automatically logs in to FieldServicer API on startup
- Handles JWT token refresh automatically
- Retries failed requests with refreshed tokens

### 2. **Available API Endpoints**

#### Auth
- `POST /Auth/Login` - Login with credentials

#### Shifts/Roster
- `GET /Shift/RosterShiftList` - Get roster shifts with filters:
  - `LocationID` - Filter by location (0 for all)
  - `ClientID` - Filter by client (0 for all)
  - `FromDate` - Start date (YYYY-MM-DD)
  - `ToDate` - End date (YYYY-MM-DD)

## Architecture

### New Files

1. **`src/config/fieldservicer.js`**
   - FieldServicer API client with axios
   - Automatic authentication and token refresh
   - Request/response interceptors

2. **Updated Files**
   - `src/config/env.js` - Added FieldServicer configuration
   - `src/services/auth/auth.service.js` - Uses real API login
   - `src/repositories/shift.repository.js` - Fetches from API instead of database

### Token Management

```javascript
// Token is automatically managed
const shifts = await fieldServicerClient.getRosterShiftList({
  locationId: 0,
  clientId: 0,
  fromDate: '2026-08-01',
  toDate: '2026-08-31'
})
```

### Status Data

From the API response, shifts include status information:
- StatusID: Numeric ID (1-12)
- Title: Status name (Unpublish, Published, Clocked-In, etc.)
- BgColor: Hex color for background (#fff4b3, #fae42, etc.)
- TxtColor: Text color (Black)

## Usage

### Start the Backend

```bash
cd backend
npm install
npm run dev
```

### Login Flow

1. Frontend calls `/api/auth/login`
2. Backend authenticates with FieldServicer API
3. Returns JWT token to frontend
4. Frontend includes token in subsequent requests

### Fetch Roster Data

```javascript
// In your repositories or services
import { fieldServicerClient } from '../config/fieldservicer.js'

// Get shifts for August 2026
const shifts = await fieldServicerClient.getRosterShiftList({
  locationId: 0,
  clientId: 0,
  fromDate: '2026-08-01',
  toDate: '2026-08-31'
})
```

## Migration Notes

### Removed Dependencies
- Seed data scripts are no longer needed
- Database is now optional (can be used for caching if needed)

### What Changed
- ✅ Auth service now calls real API
- ✅ Shift repository fetches from API
- ✅ Automatic token refresh
- ✅ JWT authentication
- ⏳ Employee repository (TODO: needs API endpoint)
- ⏳ Attendance repository (TODO: needs API endpoint)

## Next Steps

1. **Add more API endpoints** as you discover them:
   - Employees list
   - Attendance/clock-in/out
   - Reports
   - Locations
   - Clients

2. **Update other repositories** to use FieldServicer API

3. **Optional: Add caching layer** using database for performance

## Troubleshooting

### Authentication Fails
- Check credentials in `.env`
- Verify `FIELDSERVICER_FOR_PORTAL=true`
- Check API URL is correct

### Token Expired
- Token automatically refreshes before expiry
- If issues persist, check token expiry parsing in `fieldservicer.js`

### API Errors
- Check logs for detailed error messages
- Verify endpoint URLs match FieldServicer API documentation
- Check network connectivity

## Security Notes

- **Never commit `.env` file** with real credentials
- Use `.env.example` as template
- Rotate credentials regularly
- Use environment-specific credentials for dev/staging/prod
