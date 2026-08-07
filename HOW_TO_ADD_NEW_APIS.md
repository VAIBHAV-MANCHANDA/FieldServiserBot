# Adding FieldServicer APIs and Gemini Tools

The assistant uses Gemini function calling, not keyword matching. Gemini can select only functions declared by the backend, and only the backend can call FieldServicer.

## Runtime flow

```text
User question
  -> Gemini selects one declared workforce function
  -> Backend validates and sanitizes its arguments
  -> Fixed executor calls FieldServicer
  -> Backend normalizes and aggregates API rows
  -> Function result returns to Gemini
  -> Gemini writes a data-grounded answer
```

Gemini must never choose an arbitrary URL, construct authentication headers, or execute code. A tool is an allowlisted backend capability, not direct API access.

## Add a new tool

1. Confirm that the FieldServicer endpoint returns the required data. Do not expose metrics that would be filled with placeholders or zeroes.
2. Add the authenticated request method to `backend/src/config/fieldservicer.js`.
3. Normalize the response inside a repository. Preserve source identifiers and status values needed for filtering.
4. Add a precise function declaration to `backend/src/tools/workforce.tools.js`:
   - Use a unique action-oriented name.
   - Explain when the tool should and should not be selected.
   - Expose only supported scalar, enum, or array arguments.
   - Never accept an endpoint, SQL, executable code, or credentials.
5. Add the fixed tool-to-report mapping and allowlists in `backend/src/services/ai/workforceTool.service.js`.
6. Register the report method and only real metrics in `backend/src/services/reports/reportRegistry.js`.
7. Add tests covering exact wording, typos, ambiguity, no rows, and malformed Gemini arguments.

## Validation requirements

Every Gemini argument is untrusted input. Validate it before the FieldServicer call:

- Dates must be recognized relative labels or valid `YYYY-MM-DD` pairs.
- Date ranges cannot exceed `MAX_REPORT_DATE_RANGE_DAYS`.
- IDs must be non-negative integers.
- Names and search terms have fixed maximum lengths.
- Status IDs, groupings, metrics, chart types, and sort fields use allowlists.
- Result limits stay between 1 and `MAX_REPORT_ROWS`.
- Unknown fields are stripped.

## Fallbacks and review

Gemini is forced to choose one declared function. When Gemini is unavailable or returns an invalid call, the backend executes the closest safe workforce report and clearly states that assumption. Low-confidence calls, fallbacks, and zero-row results generate structured `query_miss` log entries.

Run verification after every tool addition:

```bash
cd backend
npm test
```
