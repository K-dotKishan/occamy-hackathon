# Design: Fix Persistent Mobile Login

## Guiding Principle

**Additive only.** No existing page, component, or API handler is rewritten.
Every change is a surgical addition to what already exists.

---

## Backend Changes

### 1. Extend JWT expiry to 30 days — `backend/controllers/authController.js`

**Where:** Two `jwt.sign()` calls — one in `login()`, one in `mockSocialLogin()`.

**Current:**
```js
{ expiresIn: "7d" }
```

**Change to:**
```js
{ expiresIn: "30d" }
```

This is the single most impactful fix. Users who open the app within 30 days of
their last login will never be redirected to `/login` due to token expiry.

---

### 2. Add `GET /api/auth/me` endpoint — `backend/routes/auth.js`

**Why:** `ProtectedRoute` needs a cheap endpoint to verify a stored token on boot
without triggering a full dashboard data load.

**What it returns:**
```json
{
  "id": "...",
  "name": "...",
  "role": "FIELD | ADMIN | DISTRIBUTOR | USER",
  "email": "...",
  "phone": "...",
  "enterpriseName": "..." 
}
```

**Implementation approach:**
- Add a new route handler `getMe` in `authController.js`.
- Register it as `router.get("/me", auth, getMe)` in `routes/auth.js`.
- The existing `auth` middleware already verifies the JWT — no changes needed there.
- The handler simply returns `req.user` data from the decoded token plus a DB lookup
  for fresh user details.

---

## Frontend Changes

### 3. Upgrade `ProtectedRoute.jsx` to async token validation

**Current behaviour:** Synchronous `localStorage.getItem("token")` check — if key
exists, render children; if not, redirect to `/login`. No loading state.

**Problem:** On mobile, the token may exist in `localStorage` but be expired. The
current code lets the user through, then every API call in the dashboard receives a
401 and the UI breaks silently.

**New behaviour (additive — same file):**
1. On mount, read `token` from `localStorage`.
2. If no token → redirect immediately (same as today, no regression).
3. If token exists → show a loading spinner and call `GET /api/auth/me`.
4. If `/me` returns 200 → render children (same as today).
5. If `/me` returns 401 → clear `localStorage` and redirect to `/login`.
6. If `/me` fails with a network error → assume offline, render children with
   the cached token (preserve existing offline-first behaviour).

**State added:**
```jsx
const [checking, setChecking] = useState(true)  // boot validation in progress
const [valid, setValid]       = useState(false)  // token confirmed valid
```

**Loading UI:** A minimal full-screen spinner that matches the existing app style —
no new design components required.

---

### 4. Add 401 interceptor to `api.js`

**Where:** Inside the existing `catch` block in the `api()` function, after the
offline-network-error handling.

**Addition:**
```js
// Clear session on genuine 401 (expired / revoked token)
if (err?.status === 401 || err?.error === "Unauthorized" || err?.error === "Invalid token") {
  localStorage.clear()
  window.location.href = "/login"
}
```

This is a safety net that handles the edge case where a token expires mid-session
(e.g., a user stays on the page for exactly 30 days without closing it).

---

### 5. Confirm `Login.jsx` already stores token correctly

After reading `Login.jsx`, the existing login success handler must contain:
```js
localStorage.setItem("token", data.token)
localStorage.setItem("role", data.role)
localStorage.setItem("name", data.user.name)
localStorage.setItem("userId", data.user.id)
```
This is already present. No change needed in `Login.jsx`.

---

## Data Flow Diagram

```
Mobile user reopens app
        │
        ▼
ProtectedRoute mounts
        │
        ├─ No token in localStorage ──────────────► Redirect /login
        │
        └─ Token found
                │
                ▼
        Show loading spinner
                │
                ▼
        GET /api/auth/me  (with Authorization: Bearer <token>)
                │
                ├─ 200 OK ────────────────────────► Render children (dashboard)
                │
                ├─ 401 Unauthorized ──────────────► Clear localStorage → Redirect /login
                │
                └─ Network error (offline) ───────► Render children (offline mode)
```

---

## Files Modified

| File | Type | Change |
|------|------|--------|
| `backend/controllers/authController.js` | Modify | `7d` → `30d` in both `jwt.sign()` calls; add `getMe` handler |
| `backend/routes/auth.js` | Modify | Add `router.get("/me", auth, getMe)` |
| `frontend/hackathon/src/components/ProtectedRoute.jsx` | Modify | Add async token validation + loading state |
| `frontend/hackathon/src/api.js` | Modify | Add 401 interceptor in existing catch block |

**Files NOT touched:** `Login.jsx`, `Dashboard.jsx`, `FieldDashboard.jsx`,
`DistributorDashboard.jsx`, `AdminDashboard.jsx`, `App.jsx`, any route definitions.
