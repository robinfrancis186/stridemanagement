

# Fix Plan: App Stuck on "Loading..." + Multiple Issues

## Root Problem

The app is permanently stuck showing "Loading..." (or a blank page on `/auth`). After thorough investigation:

- **Zero XHR/fetch requests** are being made by the Supabase client
- The `AuthProvider`'s `loading` state never becomes `false` because `onAuthStateChange` never fires and `getSession()` never resolves
- The `AuthRoute` on `/auth` returns `null` while loading, so the auth page is completely blank

The likely cause is that the Supabase client's internal `_initialize()` method hangs when called — the `getSession()` promise never settles. While there's a `.catch()` handler, it only catches rejections, not promises that hang indefinitely.

## Fix #1: Auth Provider — Add Timeout Fallback

**File:** `src/hooks/useAuth.tsx`

The `useEffect` should:
1. Set up `onAuthStateChange` FIRST (correct, already done)
2. Call `getSession()` (correct, already done)
3. **Add a safety timeout** (e.g., 5 seconds) that forces `setLoading(false)` if neither the listener nor `getSession()` have resolved — this prevents the infinite loading state

## Fix #2: AuthRoute Should Show Auth Page While Loading

**File:** `src/App.tsx`

Change `AuthRoute` to render `children` (the auth page) while loading, instead of returning `null`. There's no reason to hide the login form while checking session — if the user turns out to be logged in, it'll redirect. But if not, the form should already be visible.

```
Current:  if (loading) return null;
Fix:      if (loading) return <>{children}</>;
```

## Fix #3: Trigger on auth.users Schema (Security Concern)

The `on_auth_user_created` trigger is attached to `auth.users` (a reserved schema). This was confirmed via query. Per Lovable Cloud guidelines, triggers should NOT be attached to reserved schemas. The fix is to:

1. Drop the trigger on `auth.users`
2. Instead, handle profile creation in the signup flow (client-side) or via a database function called from an edge function/webhook

However, this is a separate concern from the loading bug and can be addressed after the app is functional.

## Fix #4: RLS Policy Type — All Policies Use RESTRICTIVE

All RLS policies in the database use `Permissive: No` (meaning they are **RESTRICTIVE**). This is a critical issue:
- In PostgreSQL, RESTRICTIVE policies use AND logic — ALL restrictive policies must pass
- For a SELECT + INSERT scenario, a restrictive SELECT policy and a restrictive INSERT policy would both need to pass for any operation
- The standard pattern should use **PERMISSIVE** policies (the default) where ANY matching policy allows access

This means even authenticated admin users may be unable to insert/update data because the `SELECT` restrictive policy and `INSERT` restrictive policy conflict. This needs a migration to recreate all policies as PERMISSIVE.

## Fix #5: Missing `user_roles` Record for New Users

When a user signs up, no `user_roles` record is created. The `handle_new_user` trigger only creates a `profiles` record. Without a role, the `has_role()` function always returns false, meaning COE Admins can't insert/update any data.

The fix: either add a default role insertion in the trigger, or provide an admin UI/migration to assign the first user as `coe_admin`.

## Implementation Order

1. **Fix AuthRoute** to show login form while loading (App.tsx)
2. **Add timeout** to AuthProvider so loading never hangs forever (useAuth.tsx)
3. **Fix RLS policies** — recreate all as PERMISSIVE (migration)
4. **Add default role assignment** for new users (migration or client-side)
5. **Move trigger off auth.users** to client-side profile creation (migration)

## Technical Details

### Auth timeout implementation
```typescript
useEffect(() => {
  const timeout = setTimeout(() => {
    setLoading(false);
  }, 5000);

  // ... existing onAuthStateChange + getSession code ...
  // Clear timeout when loading becomes false naturally

  return () => {
    clearTimeout(timeout);
    subscription.unsubscribe();
  };
}, []);
```

### RLS migration scope
All 11 tables need their policies dropped and recreated as PERMISSIVE:
- requirements, state_transitions, phase_feedbacks, profiles, user_roles
- notifications, requirement_files, requirement_versions
- doe_records, committee_reviews, committee_decisions
- designathon_events, designathon_teams

### First user bootstrap
A migration to insert a `coe_admin` role for the first user who signs up, or a seed mechanism via an edge function that checks if any admin exists and promotes the first signup.

