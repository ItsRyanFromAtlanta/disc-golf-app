# Login (Account / Save Your Progress)

| Field | Value |
|---|---|
| Route id | `login` |
| URL pattern | `/login` |
| Section | **none** — `PUBLIC_ROUTES` entries carry no `section` field (`routeMetadata.js:316`) |
| Shell | `none` |
| Header title | **none** — no `title` field. The page supplies its own `h1`, which is `Account` or `Save Your Progress` |
| Activity pill | **none** — no `showActivityPill` field |
| Scroll key | **none** — no `scrollKey` field |
| Preserves nested state | **none** — no `preserveNestedState` field |
| Page component | `src/pages/AuthPage.jsx` (248 lines) |
| Blueprint screen | Screen 2 — `AuthRecoveryView` |
| Verified against | `eb9fd2b` |

As with `root`, the four "none" rows are absent keys rather than `null` values; see `screens/root.md`
for why that distinction matters. `AppShell` and `GlobalHeader` never mount on this route, so no
consumer reads them.

## 1. Purpose

The single account surface: sign in, create an account, or attach an identity to an existing guest
session. Email OTP is the default and only fully in-app path; password and Apple/Google SSO are
alternates. The screen's job is to get a usable session onto the device with the least typing possible
in outdoor light, and — since 2026-07-27 — to say out loud when SSO will not work.

## 2. Entry and exit

**This route has no guard of any kind.** `src/App.jsx:51` is a bare
`<Route path="/login" element={<AuthPage />} />` — no `ProtectedRoute`, unlike `/onboarding`, and no
session ternary, unlike `/`. It renders for signed-out users, for guests, and for fully signed-in users
alike. That asymmetry is deliberate for guests (they need this screen to convert) and probably
unintended for signed-in accounts; see § 12.

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Get Started` on the splash | `navigate('/login')` | Primary signed-out path |
| In | `Already have an account? Sign in` on the splash | `<Link to="/login">` | Same destination |
| In | Guest sign-in failed on the splash or on this page | `navigate('/login')` | Silent fallback; no message accompanies it |
| In | Any protected route with no session | `<Navigate to="/login" replace />` from `ProtectedRoute.jsx:8` | Fires from the whole `AppShell` tree **and** from `/onboarding`, which is wrapped directly |
| In | Sign out | `signOut()` in `PracticeMenuPage.jsx:148` or `RegimenSelectPage.jsx:45` | No explicit navigation — the session clears, `AuthProvider` re-renders, `ProtectedRoute` redirects |
| In | Direct URL / bookmark | Route match | The only way a guest can reach the conversion UI — see § 12 |
| Out | Password submit succeeds | `navigate('/practice')` | Onward routing, including a first-run bounce, is left to `useOnboardingGate` in `AppShell` (`AuthPage.jsx:64-66`) |
| Out | OTP verify succeeds | `navigate('/practice')` | Same for guest conversion, which stays on the same `user.id` |
| Out | `link-guest` succeeds | `navigate('/onboarding')` | Skips `/practice` entirely — a brand-new anonymous user has zero bags |
| Out | `link-guest` fails | `navigate('/login')` | A no-op self-navigation; the user sees nothing change |
| Out | `sso-apple` / `sso-google` starts | Supabase redirects the **whole document** to the provider | Returns to `${window.location.origin}/practice` (`AuthContext.jsx:48`, `:62`). Not a router navigation — full page unload |
| Out | Create-account submit with no session returned | *stays on this screen* | Sets `mode` back to `login` and shows `Check your email to confirm your account, then sign in.` |

**Back behavior.** No back control — no shell header. Browser back returns to `/` (splash) when the user
arrived by tapping through, or leaves the app.

**Tab re-tap.** **N/A** — no `TabBar` on this route.

**Query parameters.** None read. Note that the OAuth callback lands on `/practice`, not here, so this
screen never parses a provider response.

## 3. Layout

### 3a. Frame (illustrative)

Drawn in the default state: not a guest, `entryMethod: 'otp'`, `otpSent: true`, on an installed iOS PWA
so the SSO caveat is present.

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  Account                                              | <- h1; "Save Your Progress" when isGuest
|                                                       |
|  [ Sign In ]  [ Create Account ]                      | <- ChipGroup AUTH_MODES; hidden when isGuest
|  [ ⚡ Email code ]  [ 🔑 Password ]                    | <- ChipGroup ENTRY_METHODS; always present
|                                                       |
|  Email                                                |
|  +-------------------------------------------------+  |
|  | athlete@example.com                             |  | <- disabled once the code is sent
|  +-------------------------------------------------+  |
|                                                       |
|  Enter the 6-digit code                               | <- .editor-label span, not a <label>
|  +---+ +---+ +---+ +---+ +---+ +---+                  |
|  | 1 | | 4 | | 2 | | 8 | |   | |   |                  | <- OtpInput, 6 boxes, 56px tall
|  +---+ +---+ +---+ +---+ +---+ +---+                  |
|                                                       |
|  Code sent to athlete@example.com                     | <- .form-info; .form-error takes this slot
|                                                       |
|  [x] Keep me signed in offline (365-day guarantee)    | <- checked + disabled + readOnly: inert
|                                                       |
|  +-------------------------------------------------+  |
|  |              Verify & Continue                  |  | <- disabled until otp.length === 6
|  +-------------------------------------------------+  |
|          Use a different email                        |
|                                                       |
|  On the installed app, Apple and Google sign-in open  | <- .sso-note; only when
|  in Safari and may not carry the session back here.   |    platform.oauthLeavesApp
|  Use the email code above — it completes without      |
|  leaving the app.                                     |
|                                                       |
|  +----------------------+ +----------------------+    |
|  |     Apple            | |      Google          |    | <- .sso-button, --tap-target-min
|  +----------------------+ +----------------------+    |
|                                                       |
|   Play instantly as guest — save progress later       | <- hidden when isGuest
+-------------------------------------------------------+
|  [HOME INDICATOR]                                     |
+-------------------------------------------------------+
```

No header, no tab bar, no sheet host. The page is one `<section class="auth-page">` sharing the standard
page block (`max-width: 480px`, `padding: 32px 20px`, `text-align: left` — `App.css:1-32`). It is not a
scroll region; on a small viewport the document body scrolls, which is the only screen-level scrolling in
the app not owned by `ScreenScrollRegion`.

### 3b. Region outline (normative)

```
App-level, outside Routes
  pwa-update ............. PwaUpdatePrompt — renders on this route
Auth section (.auth-page)
  hdr-title .............. h1: "Save Your Progress" when isGuest, else "Account"
  guest-note ............. .form-info; isGuest only
  mode-chips ............. ChipGroup over AUTH_MODES; !isGuest only
    mode-login ........... "Sign In"
    mode-signup .......... "Create Account"
  method-chips ........... ChipGroup over ENTRY_METHODS; always
    method-otp ........... "⚡ Email code"   (initial)
    method-password ...... "🔑 Password"
  Password form ............................ entryMethod === 'password'
    pw-email ............. labelled input, type=email, required
    pw-password .......... labelled input, type=password, required, minLength 6
    pw-error ............. .form-error
    pw-info .............. .form-info
    pw-submit ............ "Sign In" | "Create Account" | "Please wait..."
  OTP form (.otp-form) ..................... entryMethod === 'otp'
    otp-email ............ labelled input, type=email, required; disabled once sent
    otp-label ............ span "Enter the 6-digit code"; otpSent only
    otp-grid ............. OtpInput (6 boxes); otpSent only
    otp-error ............ .form-error
    otp-info ............. .form-info
    otp-guarantee ........ checkbox, checked + disabled + readOnly — inert
    otp-submit ........... "Send Code" | "Verify & Continue" | "Please wait..."
    otp-change-email ..... "Use a different email"; otpSent only
  sso-note ............... .form-info.sso-note; platform.oauthLeavesApp only
  sso-row
    sso-apple ............ IconBrandApple + "Apple"
    sso-google ........... IconBrandGoogle + "Google"
  link-guest ............. "Play instantly as guest — save progress later"; !isGuest only
```

Two structural facts worth stating, because they are easy to get wrong:

1. `error` and `info` are **rendered inside each form branch**, not once at page level. Switching entry
   method unmounts one copy and mounts the other, and the `onSelect` handler clears `error`, `info`, and
   `otpSent` (`AuthPage.jsx:138-143`). So method switching is a full reset of the transient state.
2. `sso-note`, `sso-row`, and `link-guest` sit **outside both forms**. An error raised by `handleOAuth`
   is therefore displayed inside whichever form happens to be showing — physically above the submit
   button and well above the SSO buttons that caused it. See § 8.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Save Your Progress` when `isGuest`, else `Account` | — | — | — | always. `isGuest` is `user.is_anonymous ?? false` (`AuthContext.jsx:24`) |
| `guest-note` | text | `You're playing as a guest. Add an email or connect Apple/Google to keep your progress across devices.` | present / absent | — | — | `isGuest` only |
| `mode-login` / `mode-signup` | chip | `Sign In` / `Create Account` | active / inactive | set `mode`, clear `error` and `info` | local state | rendered only when **not** a guest — a guest cannot "sign in" as someone else without abandoning their progress |
| `method-otp` / `method-password` | chip | `⚡ Email code` / `🔑 Password` | active / inactive | set `entryMethod`, clear `error`, `info`, `otpSent` | local state | always; `otp` is the initial value |
| `pw-email` | input | label `Email` | default / invalid | set `email` | local state | `type=email`, `required`, `autoComplete="email"` |
| `pw-password` | input | label `Password` | default / invalid | set `password` | local state | `required`, `minLength={6}`; `autoComplete` is `current-password` in login mode and `new-password` in signup mode |
| `pw-submit` | button | `Sign In` \| `Create Account` \| `Please wait...` | idle / submitting | `signIn` or `signUp` | GoTrue | disabled while `submitting` |
| `otp-email` | input | label `Email` | default / **disabled once the code is sent** | set `email` | local state | `type=email`, `required`, `autoComplete="email"` |
| `otp-label` | span | `Enter the 6-digit code` | present / absent | — | — | `otpSent` only. A `<span class="editor-label">`, **not** a `<label>` — it labels nothing programmatically |
| `otp-grid` | 6 inputs | per-box `aria-label="Digit N"` | empty / filled per box | set `otp` | local state | `otpSent` only. `inputMode="numeric"`; `autoComplete="one-time-code"` on box 1 only; paste fills all boxes. Non-digits stripped |
| `otp-error` / `pw-error` | text | raw `error.message` from supabase-js | present / absent | — | — | any failed call, including a failed OAuth *start* |
| `otp-info` / `pw-info` | text | `Code sent to {email}` or `Check your email to confirm your account, then sign in.` | present / absent | — | — | set on OTP send and on session-less signup |
| `otp-guarantee` | checkbox | `Keep me signed in offline (365-day guarantee)` | **permanently checked, disabled, readOnly** | none | none | Not a control. It is a *label* over `persistSession: true` / `autoRefreshToken: true` in `supabaseClient.js:16-21` — there is no 365-day token and no state behind the box. `SCREEN_SPECS.md:107` is explicit that this is an honesty note |
| `otp-submit` | button | `Send Code` \| `Verify & Continue` \| `Please wait...` | idle / submitting / blocked | `handleSendOtp` or `handleVerifyOtp` | GoTrue | disabled when `submitting || (otpSent && otp.length < 6)` — the only length interlock on this screen |
| `otp-change-email` | button | `Use a different email` | present / absent | `setOtpSent(false)` | local state | `otpSent` only. Re-enables `otp-email`. Does **not** clear `otp`, `error`, or `info` |
| `sso-note` | text | `On the installed app, Apple and Google sign-in open in Safari and may not carry the session back here. Use the email code above — it completes without leaving the app.` | present / absent | — | — | `platform.oauthLeavesApp`, i.e. iOS-like **and** standalone display (`platform.js:27-29`). Read once on mount |
| `sso-apple` / `sso-google` | button | `Apple` / `Google` | default / pressed. **No submitting or disabled state** | `signInWithOAuth` or, for a guest, `linkIdentity` | provider redirect → `${origin}/practice` | always — including on an installed iOS PWA where the note says it may not work. See § 12 |
| `link-guest` | button | `Play instantly as guest — save progress later` | default / pressed. **No loading or disabled state** | `signInAnonymously()` then navigate | `/onboarding` on success, `/login` on error | `!isGuest` only |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Platform/display context | `readPlatformContext()` | `lib/platform` | `navigator` + `window.matchMedia` | **impure wrapper over pure predicates**; read once via `useState(readPlatformContext)` (`AuthPage.jsx:35`) |
| Guest flag | `isGuest` | `context/AuthContext` | `user.is_anonymous` | React context |

**No table is queried.** Every other read on this screen is local component state. `readPlatformContext`
is deliberately called once at mount with the initializer form, because display mode does not change
within a session — the comment at `AuthPage.jsx:34` says so. A user who installs the PWA mid-session and
reopens gets the note on the next mount.

Signatures for `isIosLike`, `isStandaloneDisplay`, `oauthRedirectLeavesApp`, and `readPlatformContext`
are in `LIB_API_INDEX.md`.

### Writes

All writes are Supabase GoTrue calls exposed by `AuthContext`. None touches an application table; none
carries an idempotency key; none participates in a Dexie transaction.

| Mutation | Call | Underlying | Notes |
|---|---|---|---|
| Sign in with password | `signIn(email, password)` | `supabase.auth.signInWithPassword` | |
| Create account with password | `signUp(email, password)` | `supabase.auth.signUp` | Returns `data.session === null` when email confirmation is required — handled explicitly |
| Send email OTP | `signInWithOtp(email)` | `supabase.auth.signInWithOtp({ options: { shouldCreateUser: true } })` | One call serves both sign-in and create-account; Supabase treats a first-time address as a signup (`AuthContext.jsx:42-44`) |
| Verify email OTP | `verifyOtp(email, token)` | `supabase.auth.verifyOtp({ type: 'email' })` | |
| Start SSO | `signInWithOAuth(provider)` | `supabase.auth.signInWithOAuth({ options: { redirectTo: origin + '/practice' } })` | Redirects the document |
| Anonymous sign-in | `signInAnonymously()` | `supabase.auth.signInAnonymously` | |
| **Guest** — begin email claim | `convertGuestWithOtp(email)` | `supabase.auth.updateUser({ email })` | On an anonymous user this **sends a confirmation OTP** rather than changing the address outright |
| **Guest** — complete email claim | `verifyGuestConversion(email, token)` | `supabase.auth.verifyOtp({ type: 'email_change' })` | Note the different `type` from the non-guest path |
| **Guest** — link SSO | `linkGuestWithOAuth(provider)` | `supabase.auth.linkIdentity` | Adds an identity to the existing user |

**Why conversion preserves progress.** It is the *same* `user.id` before and after — `updateUser` and
`linkIdentity` attach an identity to the existing anonymous user rather than creating a new one
(`AuthContext.jsx:54-58`). Every owner-scoped row already written under that id stays owned by it. This
is standing divergence #4's whole point, and it is why guest mode is not a local shadow database.

`PHASE_A_ARCHITECTURE.md` § 14 governs activity-lifecycle transitions and does not bind here.

### Offline

**Nothing on this screen works offline.** All nine mutations are network calls; there is no queue, no
outbox, and no optimistic path. A failure surfaces as the raw supabase-js `error.message` — for a network
failure that is typically `Failed to fetch`, rendered verbatim in `.form-error`.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`, `Synced`,
`Needs Attention`) is displayed. That is defensible — there is no local work pending — but it means the
"365-day guarantee" checkbox is the only offline-related affordance on the screen, and it is inert.

The guarantee it labels is real in a different sense: `persistSession: true` keeps the refresh token in
localStorage, so a returning user with a valid token is redirected from `/` to `/practice` with no
network round trip and never reaches this screen. Users only land here offline if they have no session
at all, at which point they are stuck.

## 6. Flow paths

**Happy path — email OTP (default).**
1. Arrive signed out. `entryMethod` is `otp`, `mode` is `login`, `otpSent` is `false`.
2. Type an email → `Send Code` → `signInWithOtp(email)` with `shouldCreateUser: true`.
3. `otpSent` becomes true. `otp-email` locks, `otp-grid` appears, info reads `Code sent to {email}`.
4. Enter six digits. `otp-submit` un-blocks at exactly six.
5. `Verify & Continue` → `verifyOtp` → `navigate('/practice')`.
6. `AppShell` mounts; `useOnboardingGate` decides whether this user goes on to `/onboarding`.

Terminal state: `/practice` for a returning user, `/onboarding` for a first-time address.

**Happy path — password.** Switch to `🔑 Password` (which clears `error`, `info`, `otpSent`) → email +
password → `Sign In` → `navigate('/practice')`. Terminal state: same as above.

**Create account with confirmation required.** `mode: signup` + password submit → `signUp` returns
`data.session === null` → the screen **stays put**, sets `info` to
`Check your email to confirm your account, then sign in.`, and flips `mode` back to `login`
(`AuthPage.jsx:59-63`). Terminal state: this screen, in login mode, with an info message. Nothing is
navigated.

**Guest conversion.** Reachable only with an anonymous session *and* a manual navigation to `/login`
(§ 12). `h1` reads `Save Your Progress`; the mode chips and the guest link are both suppressed; `Send
Code` calls `convertGuestWithOtp` (`updateUser({ email })`) and `Verify & Continue` calls
`verifyGuestConversion` (`verifyOtp` with `type: 'email_change'`). Terminal state: `/practice`, same
`user.id`, now with an email identity. Every bag, disc, and session recorded as a guest is retained.

**Anonymous sign-in from here.** `link-guest` → `signInAnonymously()` → `/onboarding` on success,
`/login` on failure with no message — identical to the splash implementation (`AuthPage.jsx:105-108`
duplicates `SplashPage.jsx:13-18`).

**SSO — ordinary browsers.** Tap Apple or Google → `signInWithOAuth` → the document is replaced by the
provider's page → the provider returns to `${origin}/practice` → `AuthProvider`'s
`onAuthStateChange` picks up the session. If starting the flow fails, `error` is set and rendered inside
the currently-visible form. Nothing else happens in-page, because on success the page is gone
(`AuthPage.jsx:100-102`).

**SSO — installed iOS PWA.** `readPlatformContext()` reports `oauthLeavesApp: true` when the client is
iOS-like *and* running standalone. The screen then renders `sso-note`, telling the user that Apple and
Google sign-in will open in Safari and may not carry the session back, and steering them to the email
code. This is the shipped mitigation from 2026-07-27 (`docs/mobile/IOS_READINESS.md`). It is **advisory
only**: both SSO buttons remain fully enabled and tappable, so a user who ignores the note still gets the
broken flow. See § 12.

**First run / empty.** **N/A** — the screen has no data-bearing region and looks identical on a first
visit and a thousandth.

**Error.** Every handler follows the same shape: clear `error`, set `submitting`, await, clear
`submitting`, and on failure `setError(error.message)` and return without navigating. The user stays on
the screen with all input preserved and can retry immediately. Two exceptions: `handleOAuth` does not
manage `submitting` at all, and `handleGuest` discards its error entirely.

**Offline.** As § 5. Every action fails with a raw fetch error string in `.form-error`; the screen
remains usable and retryable, and no full-screen error replaces it. `PHASE_A_ARCHITECTURE.md` § 12's
"a network failure never replaces active capture with a full-screen error" is about capture and does not
bind here, but this screen satisfies it anyway.

**Auth / guard.** No guard runs on this route. An already-signed-in non-guest who navigates here sees the
full `Account` sign-in form rather than a redirect — unlike `/`, which redirects. Signing in again as the
same or a different user simply replaces the session.

**Interlock.** The only enable-rule interlock is the six-digit floor on `otp-submit`
(`AuthPage.jsx:207`). Password minimum length is enforced by the browser through `minLength={6}`, not by
the app. Supabase's own rate limiting on OTP sends is server-side and surfaces as an error string; the
screen has no client-side send throttle and no resend cooldown.

**Destructive.** **N/A** — nothing on this screen deletes or discards. Note that signing in as a
*different* account while a guest session is live would abandon the guest's data, but there is no
in-app route to that: the mode chips are suppressed for guests precisely so the only offered actions
are conversions.

## 7. Dependencies

### Schema
**None in the application schema.** All state lives in Supabase's managed `auth.users` and
`auth.identities`. `user.is_anonymous` is the guest flag; conversion adds an identity rather than
changing the user id. No migration in `supabase/migrations/` touches this screen.

### Library
`context/AuthContext` (nine auth methods), `lib/platform` (`readPlatformContext` and its three pure
predicates), `lib/supabaseClient` (transitively — its `persistSession`/`autoRefreshToken` options are
what the guarantee checkbox describes). Signatures in `LIB_API_INDEX.md`.

### Components
`ChipGroup` (×2 — auth mode and entry method), `OtpInput` (its only consumer in the codebase),
`@tabler/icons-react` `IconBrandApple` / `IconBrandGoogle`. Details in `COMPONENT_LIBRARY.md`.

### Screens
`root` links in twice. `onboarding` is the post-guest destination and is also protected by
`ProtectedRoute`, so it can bounce back here. Every shell route can redirect here via `ProtectedRoute`.
`play-root` and `regimen-select` reach it indirectly by calling `signOut()`. `settings` owns account
deletion, which lands on `/`, not here.

### Contracts and decisions
`PHASE_A_ARCHITECTURE.md` § 12 (presentation and accessibility), § 13 (why this route is shell-less),
§ 9 (the missing E2E gate this screen most needs). `SCREEN_SPECS.md` standing divergence #4 governs the
OTP digit count and guest model. `docs/mobile/IOS_READINESS.md` records the SSO caveat. No blocking ADR
— `docs/decisions/0003-native-capability-timeline.md` is adjacent (a native shell would change the SSO
story) but does not gate this screen.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good.** Both email inputs and the password input have real `<label htmlFor>`/`id` pairs
  (`AuthPage.jsx:148-168`, `:178-187`), matching the pattern `disc-detail` sets. `autoComplete` is
  correct throughout, including `current-password` versus `new-password` by mode.
- **Good.** Every OTP box carries `aria-label="Digit N"` and `inputMode="numeric"`, and
  `autoComplete="one-time-code"` is on the first box only — the right hint for platform code suggestion,
  and correctly not the SMS-only WebOTP API, since this is email OTP.
- **Good.** The iOS SSO caveat is visible text rather than a silent degradation, which is the same
  honesty contract the onboarding haptic fallback follows.
- **Gap — no landmark.** A bare `<section class="auth-page">` with no accessible name exposes no
  landmark. Shared with `root` and `onboarding`; tracked as `T-root-4`.
- **Gap — errors are not announced.** `.form-error` and `.form-info` are plain `<p>` elements with no
  `role="alert"`, no `role="status"`, and no `aria-live`. A screen-reader user who submits a wrong code
  gets no announcement; the message simply appears. This is the single highest-value accessibility fix
  on the screen.
- **Gap — SSO errors surface in the wrong place.** `handleOAuth` sets the same `error` state the forms
  render, so a failure to *start* Apple sign-in appears inside the email form, above the submit button,
  and above the SSO row that caused it. Sighted users may not connect the two; non-sighted users get no
  announcement at all.
- **Gap — the OTP grid is not a labelled group.** `otp-label` is a `<span class="editor-label">`, so the
  six boxes have per-box labels but no group name and no `role="group"`/`aria-labelledby`. The instruction
  "Enter the 6-digit code" is visible but not programmatically associated.
- **Gap — the guarantee checkbox is a disabled control that cannot be understood.** `checked disabled
  readOnly` renders as a permanently-on checkbox with no explanation of why it cannot be changed. To
  assistive tech it is simply an unavailable control. If it is a statement rather than a choice, it
  should not be a checkbox.
- **Gap — no busy state on SSO or guest.** Neither `handleOAuth` nor `handleGuest` sets `submitting`, so
  both buttons stay enabled through their awaits with no `aria-busy` and no visual change.
- **Tap targets.** `.sso-button` and `.btn-primary` both use `min-height: var(--tap-target-min)`
  (`App.css:433-446`, `:3955-3968`); `.otp-input-box` is a fixed 56px tall (`App.css:3931-3939`). The
  three `.link-button` controls (`otp-change-email`, `link-guest`) have no minimum height — same
  shortfall as the splash links.
- **Known token-level issue.** The `.btn-primary` contrast note at `App.css:426-432` applies to both
  submit buttons here.

## 9. Events and telemetry

**N/A** — no metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted, no notification from § 7
is produced or consumed, and no lifecycle event from § 2 is written. Sign-in, sign-up, conversion, and
SSO produce no application-side event of any kind; the only record is Supabase's own auth log.

Worth stating because it is a genuine hole rather than an accident of scope: there is no way to answer
"how many users start OTP and never complete it" or "how often does SSO fail on iOS PWAs" from anything
this app records. The iOS SSO caveat shipped on the strength of an audit, and its effectiveness cannot
currently be measured.

## 10. Tests

### Existing coverage

`src/lib/platform.test.js` — 12 cases across `isIosLike` (classic iOS UAs, iPadOS desktop mode, a real
Mac, Android, empty input), `isStandaloneDisplay`, `oauthRedirectLeavesApp` (true only for iOS +
standalone), and `readPlatformContext` (installed iOS PWA, installed Android PWA, missing
navigator/window). The decision logic behind `sso-note` is genuinely well covered.

`src/lib/routeMetadata.test.js:91` asserts `/login` resolves to id `login` with `SHELL_TYPES.NONE`.

**That is the entire coverage, and it does not touch a single auth call.** There is **no auth flow
test**. Nothing exercises `AuthPage.jsx`, `OtpInput.jsx`, or `AuthContext.jsx`. OTP send, OTP verify,
password sign-in, password sign-up, the session-less signup branch, SSO start, anonymous sign-in, and
both guest-conversion calls are all untested — including the `type: 'email'` versus
`type: 'email_change'` distinction, which is the kind of one-token difference a refactor silently breaks
and which would strand every guest's progress if it regressed.

`TEST_MAP.md:90` records this: *"No auth flow test. OTP, SSO, and anonymous sign-in are untested."*
**This is the highest-risk untested surface in the application** — it is the only door into the product,
it has nine distinct mutation paths, and a regression in any of them is total rather than partial.

### Acceptance criteria

1. `entryMethod` defaults to `otp` and `mode` defaults to `login` on a fresh mount.
2. `Send Code` calls `signInWithOtp` with `shouldCreateUser: true` for a non-guest, and
   `updateUser({ email })` for a guest.
3. `Verify & Continue` calls `verifyOtp` with `type: 'email'` for a non-guest and `type: 'email_change'`
   for a guest.
4. `otp-submit` is disabled at 0–5 digits and enabled at exactly 6.
5. Sending a code disables `otp-email`; `Use a different email` re-enables it.
6. Switching entry method clears `error`, `info`, and `otpSent`.
7. A password signup that returns no session keeps the user on this screen, shows the confirm-email
   info, and sets `mode` to `login` — it does **not** navigate.
8. A guest sees `Save Your Progress`, the guest explanation, no mode chips, and no guest link.
9. A non-guest sees `Account`, both mode chips, and the guest link.
10. `sso-note` renders when and only when `readPlatformContext()` reports `oauthLeavesApp: true`.
11. A failed call of any kind leaves every entered value intact and shows the provider's message.
12. Guest conversion completes on the **same `user.id`** — assert the id before and after.
13. Entering a digit in a non-adjacent OTP box does not silently relocate it (**currently fails** — see
    § 12).

### E2E critical paths

`TEST_MAP.md` § E2E backlog item 5 — *"Sign in with email OTP → land on `/practice`"* — is the priority-2
entry for this screen. Beyond it:

- Guest sign-in → record practice data → convert via email code → verify the data survives and the user
  id is unchanged.
- Sign out from `/practice` → land here via `ProtectedRoute` → sign back in → land on `/practice`.
- Installed-PWA emulation on an iOS user agent → assert `sso-note` renders.
- Password signup requiring confirmation → assert no navigation occurs.

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9; `TASK_FORMAT.md` § Verification
commands). These are backlog entries, not existing coverage.

## 11. Tasks

#### T-login-1 — Add an auth flow test suite

- **Capability:** `security`
- **Touches:** `src/pages/AuthPage.test.jsx` (new), `src/context/AuthContext.test.jsx` (new)
- **Done when:** Every branch in § 10's acceptance criteria 2, 3, 7, 8, 9, and 12 is asserted against a
  mocked `supabase.auth`, including the `email` versus `email_change` OTP type distinction and the
  same-`user.id` conversion invariant.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
- **Commit:** `test: cover the auth flows on the sign-in screen`
- **Note:** highest priority task in this document; every other login task is safer to land after it.

#### T-login-2 — Fix non-sequential digit entry in `OtpInput`

- **Capability:** `ui-interaction`
- **Touches:** `src/components/OtpInput.jsx`, `src/components/OtpInput.test.jsx` (new)
- **Done when:** Typing a digit into box 5 while boxes 3 and 4 are empty places that digit at index 4 and
  leaves the gaps empty, rather than collapsing it leftward.
- **Verify:** `npm test` with cases for sequential entry, gap entry, paste, and mid-value backspace.
- **Commit:** `fix: keep OTP digits in the box they were typed into`
- **Blocked by:** nothing, but land `T-login-1` first so the page-level behavior is pinned.

#### T-login-3 — Announce auth errors and info messages

- **Capability:** `ui-routine`
- **Touches:** `src/pages/AuthPage.jsx`
- **Done when:** `.form-error` carries `role="alert"` and `.form-info` carries `role="status"` on this
  screen, and an SSO start failure renders adjacent to the SSO row rather than inside the form.
- **Verify:** `npm run lint` plus a manual VoiceOver pass submitting a wrong code at `/login`.
- **Commit:** `fix: announce sign-in errors to assistive tech`

#### T-login-4 — Add a landmark to the pre-shell screens

- **Capability:** `ui-routine`
- **Touches:** see `T-root-4`
- **Done when:** as `T-root-4`.
- **Verify:** as `T-root-4`.
- **Commit:** `fix: expose a main landmark on the pre-shell screens`
- **Note:** the same change as `T-root-4` and `T-onboarding-6`; land once.

#### T-login-5 — Give SSO and guest buttons an in-flight state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/AuthPage.jsx`
- **Done when:** `handleOAuth` and `handleGuest` set and clear `submitting` like the other two handlers;
  both buttons disable during their await; a failed guest sign-in shows a message.
- **Verify:** `npm run lint` plus a page-level test that rejects `signInAnonymously` once.
- **Commit:** `fix: disable SSO and guest buttons while signing in`

#### T-login-6 — Decide and implement a reachable guest-conversion entry point

- **Capability:** `ui-routine`
- **Touches:** `src/pages/SettingsPage.jsx` or `src/pages/CareerHubPage.jsx`, plus whichever surface the
  decision picks
- **Done when:** A signed-in guest can reach `/login` from inside the app in at most two taps, and the
  destination renders the `Save Your Progress` variant.
- **Verify:** `npm run dev`, sign in as guest, reach the conversion screen without editing the URL.
- **Commit:** `feat: let a guest reach account conversion from inside the app`
- **Blocked by:** § 12 open question 1 — where the entry point belongs is a product decision.

#### T-login-7 — Replace the inert guarantee checkbox with a statement

- **Capability:** `ui-routine`
- **Touches:** `src/pages/AuthPage.jsx`, `src/App.css`
- **Done when:** The offline-persistence promise is presented as text rather than a permanently-disabled
  checkbox, with wording that does not imply a 365-day server token.
- **Verify:** `npm run lint` and a manual read at `/login` with VoiceOver.
- **Commit:** `fix: state the offline persistence promise instead of faking a checkbox`
- **Blocked by:** § 12 open question 3.

## 12. Open questions

1. **A guest cannot reach the conversion screen from inside the app.** `isGuest` has exactly one consumer
   — `AuthPage.jsx` — and nothing anywhere navigates a signed-in user to `/login`. `ProtectedRoute` will
   not redirect a guest (they *are* a user), and `/` redirects them to `/practice`. So the entire
   `Save Your Progress` surface, including `convertGuestWithOtp`, `verifyGuestConversion`, and
   `linkGuestWithOAuth`, is dead code from a user's point of view unless they type the URL.
   `SCREEN_SPECS.md` Screen 2 lists guest conversion as shipped NET-NEW without noting it is unreachable.
   Logged as C-3 in `_corrections/preshell-screens.md`. Blocks `T-login-6`.
2. **A signed-in user at `/login` is not redirected.** `/` redirects anyone with a session; `/login` does
   not. For guests that is necessary. For full accounts it is probably an oversight, and it means a
   signed-in user can land on a sign-in form with no indication they are already signed in. Decide
   whether to redirect non-guests or to add an "already signed in" state.
3. **The 365-day guarantee checkbox is inert.** It cannot be unchecked, has no state behind it, and names
   a duration that does not exist as a token — `SCREEN_SPECS.md:107` is explicit that it is a UX label
   over refresh-token persistence. Whether to keep the checkbox affordance, restate it as text, or drop
   the "365-day" number is undecided. Blocks `T-login-7`.
4. **`OtpInput` relocates digits typed out of order.** `setDigit` pads the value with spaces, writes the
   indexed character, then strips **all** spaces (`OtpInput.jsx:11-14`). With `value = "12"`, typing into
   box 5 yields `"129"` — the digit lands at index 2. Sequential entry with auto-advance never triggers
   it; tapping back to correct a box, and any assistive-tech navigation that jumps boxes, does. Blocks
   `T-login-2`.
5. **SSO stays enabled where the screen says it will not work.** On an installed iOS PWA the note is
   advisory and both buttons remain live. Options: leave as-is (an informed user may still want to try),
   disable them, or route them through a system-browser hand-off. Needs a product call; the honesty note
   is shipped either way.
6. **`handleGuest` is duplicated verbatim.** `AuthPage.jsx:105-108` and `SplashPage.jsx:13-18` are the
   same six lines, including the silent error discard. Any fix to one must be applied to both, or the
   behavior forks. Candidate for extraction into `AuthContext`.
7. **A signed-out user's `h1` reads `Account`.** It is neither "Sign in" nor "Create account", and the
   route has no header title to reconcile it against. `COPY_AND_TERMINOLOGY.md` § 4 records that route
   titles and in-page headings are separate surfaces that disagree elsewhere; this is another instance,
   with the twist that here there is no route title at all.
8. **No resend cooldown on `Send Code`.** Nothing client-side throttles repeat sends; the user discovers
   Supabase's server-side rate limit as a raw error string.

## 13. Blueprint divergence

Blueprint Screen 2 is *Account Authentication & Recovery (`AuthRecoveryView`)*,
`MASTER_PROJECT_BLUEPRINT.md:158-210`. `SCREEN_SPECS.md` Screen 2 says "build as specified with the
OTP-digit and guest-mode divergences." The shipped screen diverges further than that entry records:

| Blueprint Screen 2 | Shipped |
|---|---|
| "passwordless **SMS** OTP entry", four 56px blocks, "Integrates with the native Web OTP API to auto-paste incoming SMS codes" | **Email OTP, six boxes** — standing divergence #4. `autoComplete="one-time-code"` is a platform hint, explicitly *not* WebOTP, which is SMS-only (`OtpInput.jsx:4-6`). Box height is 56px as drawn |
| `[ ⚡ 4-Digit Code ]` entry-method chip | `⚡ Email code` |
| "365-Day Offline Guarantee Checkbox: A selected-by-default … toggle extending local JWT expiration in Dexie.js" | A permanently-checked, **disabled** checkbox that toggles nothing. There is no Dexie-held JWT and no extended expiry — the honest mechanism is `persistSession`/`autoRefreshToken` in `supabaseClient.js`. `SCREEN_SPECS.md:107` states this outright |
| Header pill `[🟢 CLOUD SYNC: READY]`; `SCREEN_SPECS.md` Screen 2 lists a "sync-status pill" as NET-NEW | **Not built.** No sync pill exists anywhere on `AuthPage.jsx`. Logged as C-2 in `_corrections/preshell-screens.md` |
| Primary CTA `INSTANT SIGN IN [➔]` in the bottom 40% zone, below the guarantee checkbox and above the SSO row | `Send Code` / `Verify & Continue` inside the form, above the checkbox in source order but below it visually; there is no separate "instant sign in" control |
| "1-Tap Biometric SSO Row … leveraging native FaceID/TouchID handshakes" | Standard web OAuth redirects. Biometrics happen inside the provider's page if at all — the app has no handshake of its own. And on an installed iOS PWA the redirect commonly does not return, which is what `sso-note` exists to say |
| Screen title "Account Authentication & **Recovery**" | No recovery flow ships. There is no password reset, no `resetPasswordForEmail` call, and no "forgot password" link. Email OTP substitutes for recovery in practice, but the affordance a user looks for is absent |
| Segmented `[ SIGN IN ] / [ CREATE ACCOUNT ]` toggle "without altering layout height" | Shipped as a `ChipGroup`, and **hidden entirely for guests** — a guest is offered only conversions |

The `sso-note` (`AuthPage.jsx:223-228`) has no blueprint counterpart at all: the blueprint predates the
PWA distribution model and assumes a native shell where the OAuth hand-off returns cleanly. It is a
post-blueprint addition recorded in `docs/mobile/IOS_READINESS.md`.

Standing divergences #1 (React + Vite, not Expo/NativeWind) and #4 (email 6-digit OTP; Supabase anonymous
guest mode) apply; see `SCREEN_SPECS.md` § Standing divergences. Do not restate them per screen.
