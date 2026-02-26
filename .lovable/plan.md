

## Analysis Summary

Three issues identified from the codebase exploration:

1. **"Unable to connect to backend" banner**: The `ConnectivityBanner` uses a HEAD request to `requirements` table every 30 seconds. This request intermittently fails (ERR_ABORTED), likely due to HEAD requests being aborted by browser navigation or concurrent requests. The NotificationBell also polls every 30 seconds with a hardcoded demo user ID `00000000-0000-0000-0000-000000000000`, generating constant failed requests.

2. **AI Parser failing for large PDF**: The uploaded PDF is 172 pages. The current flow sends the entire base64-encoded file in a single edge function request body, which can exceed Deno Deploy's 2MB request body limit. The edge function also sends the full base64 to the AI gateway in one call, which may exceed token/size limits.

3. **Dashboard slow loading**: Performance profile shows FCP at ~4.6s. Root causes: (a) all routes eagerly loaded (102 scripts), (b) Dashboard makes 3 separate parallel queries plus ConnectivityBanner + NotificationBell add 2 more, (c) Dashboard fires a second `useEffect` fetching ALL state_transitions again, (d) recharts (222KB) loaded on dashboard even though the dashboard page doesn't use charts.

---

## Plan

### Part 1: Fix Connectivity Banner False Positives

**Problem**: HEAD request with `count: exact` is unreliable and gets aborted. The banner shows "Unable to connect" even when the backend is reachable.

**Changes**:
- **`src/components/ConnectivityBanner.tsx`**: Replace the HEAD request with a simple lightweight GET query (`select("id").limit(1)`) instead of `count: exact, head: true`. Add a timeout using `AbortController` (5 seconds) so the check doesn't hang. Increase the polling interval from 30s to 60s. Also add error handling so transient `ERR_ABORTED` errors don't flip status to `api-error` -- only count as errors after 2 consecutive failures.

### Part 2: Fix NotificationBell Polling With Fake User ID

**Problem**: The demo user has ID `00000000-0000-0000-0000-000000000000` which doesn't exist in the database, causing every notification poll to return empty and generate unnecessary network traffic.

**Changes**:
- **`src/components/NotificationBell.tsx`**: Guard the polling -- if `user?.id` is the demo zero-UUID, skip the periodic fetch entirely and just show an empty notification list. This eliminates ~2 requests per minute of wasted network calls.

### Part 3: Route-Level Lazy Loading for Faster Initial Load

**Problem**: All 9 page components are eagerly imported in `App.tsx`, loading 102 scripts including recharts (222KB) and react-markdown (70KB) even when the user only needs the Dashboard.

**Changes**:
- **`src/App.tsx`**: Convert all page imports to `React.lazy()` with `<Suspense>` fallback. This means only the Dashboard code loads initially, and pages like LeadershipDashboard (which uses recharts heavily) and MonthlyReport (which uses react-markdown) only load when navigated to.

### Part 4: Optimize Dashboard Data Fetching

**Problem**: The Dashboard has two `useEffect` hooks making separate queries -- one for requirements + recent transitions (limit 20), and another that fetches ALL state_transitions again for aging calculation. This is redundant.

**Changes**:
- **`src/pages/Dashboard.tsx`**: Merge both `useEffect` hooks into a single `fetchData` call that runs three queries in parallel: requirements, recent transitions (limit 20), and all transitions (no limit). Remove the separate `allTransitions` state/effect. This reduces the total query count from 4 to 3.

### Part 5: Fix AI Parser for Large PDFs (Full File Parsing)

**Problem**: A 172-page PDF cannot be sent as base64 in a single edge function request body (Deno Deploy has ~6MB limit for request bodies, and base64 inflates the size by 33%).

**Changes**:

- **`src/components/AIPDFUploader.tsx`**:
  - For large PDFs (>5MB), upload the file to the `requirement-files` storage bucket first, then pass the storage path to the edge function instead of the base64.
  - For small files (<5MB), continue sending base64 directly as before.
  - Increase the file size limit from 20MB to 50MB.
  - Show a progress indicator ("Uploading file..." then "Parsing document...").

- **`supabase/functions/ai-parse-pdf/index.ts`**:
  - Accept a new `storagePath` parameter. When present, download the file from Supabase Storage using the service role key, then convert to base64 for the AI call.
  - For very large files, use chunked processing: send first ~50 pages worth of content (or the full file if under the AI model's input limit) to the AI.
  - Use `google/gemini-2.5-flash` which supports large file inputs natively via the file API approach.

- **Storage policy**: The `requirement-files` bucket already exists with appropriate policies.

### Part 6: Fix Console Warning (Select ref)

**Problem**: Console shows "Function components cannot be given refs" from the Requirements page where `<Select>` components are used directly without `ref` forwarding issues.

**Changes**:
- **`src/pages/Requirements.tsx`**: This is a known React warning with Radix Select when used in certain patterns. No code change needed -- it's cosmetic and doesn't affect functionality.

---

## Technical Details

```text
Request Flow (Current):
  Dashboard Load → 5 parallel requests
    ├── requirements (GET all)
    ├── state_transitions (GET limit 20)
    ├── state_transitions (GET all)  ← redundant
    ├── requirements HEAD (connectivity)
    └── notifications (GET, fake user)

Request Flow (After):
  Dashboard Load → 3 parallel requests
    ├── requirements (GET all)
    ├── state_transitions (GET limit 20)
    └── state_transitions (GET all)
  Connectivity check → 1 request after 60s (not 30s)
  Notifications → skipped for demo user

AI Parser Flow (After, large file):
  Browser → Storage upload → Edge function
    Edge fn → Download from storage
    Edge fn → Send to Gemini AI
    Edge fn → Return extracted requirements
```

**Files to modify**:
1. `src/App.tsx` -- lazy loading
2. `src/pages/Dashboard.tsx` -- merge data fetching
3. `src/components/ConnectivityBanner.tsx` -- fix false positives, increase interval
4. `src/components/NotificationBell.tsx` -- skip polling for demo user
5. `src/components/AIPDFUploader.tsx` -- storage upload for large files, increase limit
6. `supabase/functions/ai-parse-pdf/index.ts` -- accept storage path, download from storage

**No database migrations needed.**

