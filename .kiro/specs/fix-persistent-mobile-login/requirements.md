# Requirements: Fix Persistent Mobile Login

## Problem Statement

When users close and reopen the Occamy Field Operations web app on mobile devices
(iOS Safari, Android Chrome), they are logged out and must re-enter credentials every
time. This causes friction for field officers, distributors, and admins who use the app
daily in the field.

## Root Cause Analysis

After inspecting the codebase:

1. **JWT expires in 7 days** (`authController.js` line: `expiresIn: "7d"`) — users who
   don't open the app for a week are automatically logged out.
2. **No `/api/auth/me` endpoint exists** — there is no way to verify a stored token on
   boot without attempting a full data-fetch API call.
3. **`ProtectedRoute` does a synchronous key-existence check only** — it does not
   validate whether the token is still valid with the backend, so an expired token
   causes a silent redirect to `/login` on the next dashboard API call.
4. **No loading state in `ProtectedRoute`** — the component redirects to `/login`
   immediately if `localStorage.getItem('token')` returns null, rather than waiting
   for a background validation to complete.

## User Stories

### US-1: 30-Day Login Persistence
**As a** field officer or distributor using the app on my mobile phone,
**I want** to remain logged in for 30 days after my last login,
**So that** I do not have to re-enter my credentials every time I reopen the app.

**Acceptance Criteria:**
- After a successful login, the JWT token must remain valid for 30 days.
- Reopening the browser tab or closing and reopening the app within 30 days must
  not require the user to log in again.
- Only an explicit "Logout" button click must clear the session.

### US-2: Token Validation on Boot
**As a** returning user reopening the app,
**I want** the app to silently verify my stored token with the backend on startup,
**So that** I am only redirected to `/login` if my token is genuinely expired or invalid,
  not due to a false-positive key-missing check.

**Acceptance Criteria:**
- On every page load, `ProtectedRoute` must read `localStorage.getItem('token')`.
- If a token exists, `ProtectedRoute` must call `GET /api/auth/me` to verify it.
- If verification succeeds, the user is taken to their dashboard as normal.
- If verification fails (401 / network error after retries), the token is cleared
  and the user is redirected to `/login`.
- While verification is in progress, a lightweight loading spinner is shown instead
  of an immediate redirect.

### US-3: Automatic Token Storage on Login
**As a** user logging in with phone/email and password,
**I want** my token to be stored in `localStorage` immediately after login,
**So that** the persistence mechanism works across all session types.

**Acceptance Criteria:**
- The existing login success handler in `Login.jsx` already calls
  `localStorage.setItem('token', ...)` — this must be confirmed to be present.
- The `/api/auth/me` endpoint must return the user's `role`, `name`, `id`, and
  `enterpriseName` so `ProtectedRoute` can restore session state on reload.

### US-4: 401 Interceptor — Clear on Genuine Expiry
**As a** user whose 30-day token has expired,
**I want** to be redirected cleanly to `/login` with my session cleared,
**So that** I am not stuck in a broken authenticated state.

**Acceptance Criteria:**
- When any API call in `api.js` receives a `401 Unauthorized` response, the
  interceptor must clear `localStorage` and redirect to `/login`.
- This must only trigger on genuine 401 responses, not on network errors.
- The existing offline-queue logic must not be affected.
