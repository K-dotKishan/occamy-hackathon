# Tasks: Fix Persistent Mobile Login

## Task 1 — Extend JWT expiry to 30 days
**File:** `backend/controllers/authController.js`
**Type:** Backend · Additive change (value update)

- [ ] Change `expiresIn: "7d"` → `expiresIn: "30d"` in the `login()` function
- [ ] Change `expiresIn: "7d"` → `expiresIn: "30d"` in the `mockSocialLogin()` function

**Validation:** New tokens issued after this change will be valid for 30 days.
Existing tokens already in users' `localStorage` keep their original 7-day expiry
— those users will need to log in once more after which they get a 30-day token.

---

## Task 2 — Add `GET /api/auth/me` endpoint
**Files:** `backend/controllers/authController.js`, `backend/routes/auth.js`
**Type:** Backend · Additive (new export + new route)

- [ ] Add `getMe` export to `authController.js`:
  ```js
  export async function getMe(req, res) {
    try {
      const user = await User.findById(req.user.id).select("-password")
      if (!user) return res.status(401).json({ error: "User not found" })
      res.json({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        enterpriseName: user.enterpriseName || null
      })
    } catch {
      res.status(500).json({ error: "Server error" })
    }
  }
  ```
- [ ] Import `getMe` in `routes/auth.js`
- [ ] Add `router.get("/me", auth, getMe)` in `routes/auth.js`

**Validation:** `GET /api/auth/me` with a valid Bearer token returns 200 + user JSON.
`GET /api/auth/me` with an expired/invalid token returns 401.

---

## Task 3 — Upgrade `ProtectedRoute.jsx` with async boot validation
**File:** `frontend/hackathon/src/components/ProtectedRoute.jsx`
**Type:** Frontend · Additive (replace synchronous guard with async + loading state)

- [ ] Add `useState`, `useEffect` imports
- [ ] Add `checking` and `valid` state
- [ ] On mount: if no token → keep existing redirect; if token → call `/api/auth/me`
- [ ] Show loading spinner while `checking === true`
- [ ] On 200: set `valid = true`, `checking = false` → render children
- [ ] On 401: clear `localStorage`, redirect to `/login`
- [ ] On network error: treat as offline → set `valid = true` (preserve offline mode)

**Validation:**
- Hard-refresh on `/dashboard` with valid token → spinner briefly → dashboard loads
- Hard-refresh with expired token → spinner → redirect to `/login`
- Hard-refresh while offline → spinner → dashboard loads (offline mode)

---

## Task 4 — Add 401 interceptor to `api.js`
**File:** `frontend/hackathon/src/api.js`
**Type:** Frontend · Additive (3 lines inside existing catch block)

- [ ] After the existing offline-network-error block in the `catch`, add:
  ```js
  if (err?.status === 401 || err?.error === "Unauthorized" || err?.error === "Invalid token") {
    localStorage.clear()
    window.location.href = "/login"
    return
  }
  ```

**Validation:** Manually expire a token (change JWT_SECRET temporarily), reload the
app, and confirm it redirects to `/login` rather than showing broken API errors.

---

## Testing Checklist

- [ ] **Android Chrome:** Login → close tab → reopen → lands on dashboard ✓
- [ ] **iOS Safari:** Login → close tab → reopen → lands on dashboard ✓
- [ ] **iOS Safari private mode:** Login → close → reopen → redirects to `/login`
  (expected — private mode clears storage on close)
- [ ] **Expired token:** Simulate by changing `JWT_SECRET` → hard refresh → redirects
  to `/login` cleanly ✓
- [ ] **Offline boot:** Disable network → hard refresh → dashboard loads in offline
  mode ✓
- [ ] **Logout:** Click logout → `localStorage.clear()` → redirects to `/login` → back
  button does not return to dashboard ✓
- [ ] **All roles:** Test Field Officer, Distributor, Admin — each lands on correct
  dashboard after reopen ✓
