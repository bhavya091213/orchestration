---
name: endpoint-testing
description: Comprehensive backend API endpoint testing — auth, validation, empty strings, DB schema sync, and end-to-end frontend data flow
triggers: ["test endpoints", "test API", "test routes", "backend testing", "500 errors", "endpoint verification"]
---

# Endpoint Testing Skill

Systematic verification of all backend API routes from database to frontend display.

## When to Use

- After making backend/API changes
- When seeing 500 errors in the browser console
- Before deploying to production
- After database schema migrations
- When adding new API routes

## Testing Protocol

### Phase 1: Database Schema Sync

Verify the actual database matches what Drizzle ORM expects.

```bash
# Connect to DB and check all tables have expected columns
export DATABASE_URL="<from .env>"
npx tsx -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
async function run() {
  // For each table the schema defines, check columns exist
  const tables = await sql\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\`;
  console.log('Tables:', tables.map(t => t.table_name).join(', '));
  
  // Check specific tables for expected columns
  // Compare against apps/web/src/db/schema/index.ts definitions
}
run();
"
```

**Key checks:**
- Every column in Drizzle schema exists in DB (especially after migrations)
- Column types match (nullable vs NOT NULL)
- Foreign keys exist
- New tables from migrations are created

**Common issue:** Drizzle `db.query.*.findMany()` selects ALL schema columns. If ANY column is missing in the DB, the entire query 500s.

### Phase 2: Empty String Sanitization

HTML forms send `""` for unfilled optional fields. This breaks PostgreSQL for date, UUID, number, and email types.

**Pattern:** Every API route that accepts POST/PATCH body data must sanitize:

```typescript
import { stripEmpty } from "@/lib/sanitize";

// BEFORE Zod validation:
const parsed = schema.safeParse(stripEmpty(body));
```

**Audit command:**
```bash
# Should return 0 results:
grep -r "safeParse(body)" apps/web/src/app/api/

# Should show all routes are fixed:
grep -r "safeParse(stripEmpty" apps/web/src/app/api/ | wc -l
```

### Phase 3: Unauthenticated Endpoint Test

Verify all routes respond correctly without auth (should be 401, not 500):

```bash
BASE="http://localhost:3001"
for endpoint in \
  "/api/licenses" "/api/events" "/api/borrow-requests" \
  "/api/tickets" "/api/departments" "/api/centers" \
  "/api/users" "/api/reports?type=by_status" \
  "/api/audit-log" "/api/dashboard" "/api/floor-plans" \
  "/api/settings" "/api/reference?type=categories" \
  "/api/models" "/api/accessories" "/api/consumables"
do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$endpoint")
  if [ "$STATUS" = "500" ]; then
    echo "FAIL $STATUS $endpoint"
  else
    echo "OK   $STATUS $endpoint"
  fi
done
```

**Expected:** All return 401 (auth required) or 200 (public). Never 500.

### Phase 4: Authenticated Endpoint Test

Login and test with a real session:

```bash
BASE="http://localhost:3001"

# Login
curl -s -c /tmp/cookies.txt -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin_email>","password":"<password>"}'

# Test all GET endpoints
for endpoint in "/api/licenses" "/api/events" "/api/departments" ...
do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/cookies.txt "$BASE$endpoint")
  echo "$STATUS $endpoint"
done
```

**Expected:** All return 200 with valid JSON. Never 500.

### Phase 5: POST/PATCH with Sample Inputs

Test creation with both filled and empty optional fields:

```bash
# Test with minimal required fields only
curl -s -b /tmp/cookies.txt -X POST "$BASE/api/licenses" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test License","seats":1}'

# Test with empty optional fields (the empty string problem)
curl -s -b /tmp/cookies.txt -X POST "$BASE/api/licenses" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","seats":1,"purchase_date":"","expiration_date":"","serial":"","license_email":""}'
```

**Key tests per route:**
- Required fields only (minimal valid payload)
- All fields including empty strings for optionals
- Invalid data (bad UUID, bad email, negative numbers)
- Null values for nullable fields

### Phase 6: Frontend Data Flow

For each view, trace the complete path:

1. **View component** sends fetch to API endpoint
2. **API route** validates with Zod, queries DB
3. **DB response** maps to TypeScript types
4. **Frontend** renders the data

**Check each view:**
```
AssetsView      -> GET /api/assets         -> AssetRow type
LicensesView    -> GET /api/licenses       -> LicenseRow type
EventsView      -> GET /api/events         -> EventRow type
BorrowRequests  -> GET /api/borrow-requests -> BorrowRow type
TicketsView     -> GET /api/tickets        -> TicketRow type
UsersView       -> GET /api/users          -> UserRow type
TeamsView       -> GET /api/departments    -> TeamRow type
CentersView     -> GET /api/centers        -> CenterRow type
ReportsView     -> GET /api/reports?type=X -> StatusRow/TeamRow/etc
AuditLogView    -> GET /api/audit-log      -> AuditRow type
DashboardView   -> GET /api/dashboard      -> DashboardData type
```

**For each:**
- Does the API SELECT match the frontend type?
- Are nullable fields handled in the UI (show "—" or "N/A")?
- Do mutations send the right shape back to the API?
- Does the Zod schema match what the frontend sends?

### Phase 7: End-to-End Verification

For each create/edit form:

1. Open the form in the browser
2. Fill in only required fields, submit -> should succeed
3. Fill in all fields, submit -> should succeed  
4. Leave optional fields empty, submit -> should NOT 500
5. Edit the created item -> form should pre-populate correctly
6. Delete the item -> should soft-delete

**Critical paths to verify:**
- Create license with N/A category -> works
- Create event with dates -> type auto-derives
- Create borrow request -> requester info shows
- Create user -> appears in users list
- Create department -> appears in department dropdowns
- Upload floor plan -> image displays
- Upload logo -> displays in settings

## Common Failure Patterns

| Symptom | Cause | Fix |
|---------|-------|-----|
| 500 on GET with auth | Missing DB column | Add column via ALTER TABLE |
| 500 on POST with empty fields | Empty string → DB type mismatch | Apply `stripEmpty()` |
| 500 on POST with valid data | Zod schema mismatch | Check field types match |
| 401 on all requests | Session expired or no auth cookie | Re-login |
| 404 on route | Route file missing or wrong path | Check app/api/ structure |
| Data shows but wrong | Type mismatch frontend vs API | Align TypeScript types |

## Quick Diagnostic

When you see a 500 error:

```bash
# 1. Check if it's a DB column issue
curl -s "$BASE/api/<endpoint>" | python3 -m json.tool

# 2. Check server logs (Next.js terminal)
# Look for "column X does not exist" or Drizzle errors

# 3. Check if stripEmpty is applied
grep "safeParse" apps/web/src/app/api/<path>/route.ts

# 4. Test the exact payload the frontend sends
# Open browser DevTools > Network > find the failing request > copy as curl
```
