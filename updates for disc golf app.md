Master Screen Inventory (Sequential Flow)

    Screen 1: Splash / Welcome Landing — Brand entry, first impression, and primary call-to-action.

    Screen 2: Account Authentication — Login, registration, and offline-first token initialization.

    Screen 3: 3-Step Zero-Typing Onboarding — Goal calibration, instant putter provisioning, and haptic testing.

    Screen 4: Main Dashboard (Play / Putt Hub) — Dynamic launchpad, active gear summary, and streak tracking.

    Screen 5: Unified Bag Management & Disc Universe — 3-tab inventory hub, capacity tracking, and catalog drill-down.

    Screen 6: Putter Lineup Management & Disc Profile — Primary/backup putter assignment, wear slider, and live Bézier flight curves.

    Screen 7: Custom Regimen Builder — Modular stage stacking, 5-putt steppers, and milestone bonus toggles.

    Screen 8: Rapid-Fire Scoring Canvas — Split-screen touch zones, visual stack tracker, and mid-round swap drawers.

    Screen 9: Session Summary & Progress Report — Putter breakdown matrix, distance drop-off curves, and 1-tap replay.

    Screen 10: Global Analytics & Offline Settings — Time-series accuracy charts, local database sync controls, and data portability.

+-------------------------------------------------------+
|  [STATUS BAR]                   [⚡ OFFLINE ENABLED]  | <- Pro Addition 4
+-------------------------------------------------------+
|                                                       |
|                                                       |
|                     ( 🥏 )                            |
|               [ GEOMETRIC LOGO ]                      |
|                                                       |
|                  DISC GOLF APP                        |
|         ELEVATE YOUR PUTTING & INVENTORY              |
|                                                       |
|                                                       |
|  "🔥 142,000+ putts logged by players this week"      | <- Pro Addition 3 (Social Proof)
|                                                       |
|  +-------------------------------------------------+  |
|  |             GET STARTED  [ ➡️ ]                 |  | <- Oswald Bold, All-Caps
|  +-------------------------------------------------+  |
|                                                       |
|         Already have an account? Sign In              |
|                                                       |
|         [ Explore as Guest (No Account Required) ]    | <- Pro Addition 1 (Guest Mode)
+-------------------------------------------------------+
|  [HOME INDICATOR BAR]                                 |
+-------------------------------------------------------+

Screen 2: Account Authentication

A clean, low-friction entry point supporting both offline-first local caching and cloud sync verification.
Visual & Typography Style Guide

    Header Zone: Compact brand header using Oswald medium weight.

    Navigation Toggle: High-contrast segmented control (SIGN IN | CREATE ACCOUNT) using Oswald condensed bold.

    Form Layout: Floating label input containers with rounded corners (rounded-xl) and distinct focus rings.

    Action Buttons: Primary solid accent button alongside clean social login outlines.

Structural Wireframe / Layout Blueprint
Plaintext

+-------------------------------------------------------+
|  [STATUS BAR: 9:20 | Dynamic Island | 5G 🔋]          |
+-------------------------------------------------------+
|  ( 🥏 ) DISC GOLF APP        [🟢 CLOUD SYNC: READY]  | <- Game-Style Server Status
+-------------------------------------------------------+
|                                                       |
|  +-------------------------------------------------+  |
|  | [  SIGN IN  ] (Active)    |    [ CREATE ACCOUNT ]|  | <- High-Contrast Oswald Toggle
|  +-------------------------------------------------+  |
|                                                       |
|  EMAIL ADDRESS                                        |
|  +-------------------------------------------------+  |
|  | ✉️  athlete@discgolfapp.com                     |  | <- 48px Touch Target
|  +-------------------------------------------------+  |
|                                                       |
|  ENTRY METHOD                                         |
|  +-------------------------------------------------+  |
|  | [ ⚡ 4-Digit Code ] (Active) | [ 🔑 Password ]  |  | <- Passwordless Gaming UX
|  +-------------------------------------------------+  |
|                                                       |
|  +-------------------------------------------------+  |
|  | [ 1 ]   [ 4 ]   [ 2 ]   [ 8 ]   (Paste from SMS)|  | <- Giant, Sun-Friendly OTP Blocks
|  +-------------------------------------------------+  |
|                                                       |
|  [ ✓ ] Keep me logged in offline (365-Day Guarantee)  | <- Outdoor Peace of Mind
|                                                       |
|=================== BOTTOM 40% ZONE ===================|
|                                                       |
|  +-------------------------------------------------+  |
|  |              INSTANT SIGN IN   [➔]              |  | <- Burnt Terracotta (#CC4E3C)
|  +-------------------------------------------------+  |
|                                                       |
|  ------------------ OR 1-TAP ACCESS ------------------  |
|                                                       |
|  +------------------------+ +----------------------+  |
|  | [  ] APPLE SIGN IN    | | [ G ] GOOGLE SIGN IN |  | <- Side-by-Side 1-Tap SSO
|  +------------------------+ +----------------------+  |
|                                                       |
|   [ Play Instantly as Guest — Save Progress Later ]   | <- Gaming Sandbox Escape Hatch
|                                                       |
+-------------------------------------------------------+
|  [HOME INDICATOR BAR]                                 |
+-------------------------------------------------------+

THEMESun-Drenched Topo:
2. High-Fidelity HTML/CSS Render (iPhone 17 Pro Max Resolution)

You can save the code below as an .html file and open it in any browser. It scales the 1320 × 2868 pixel iPhone 17 Pro Max display resolution into a clean device container using the exact hex tokens from your theme file:
HTML

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Disc Golf App — Sun-Drenched Topo Mockup</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  
  <style>
    /* DESIGN TOKENS FROM THEME MARKDOWN */
    :root {
      --bg-primary: #F4F1EA;       /* Warm Sand / Parchment */
      --bg-surface: #E2DED4;       /* Desert Clay */
      --bg-surface-alt: #D6CEBF;   /* Deep Sand */
      --text-primary: #1A1D1A;     /* Deep Slate */
      --text-secondary: #4A524A;   /* Muted Slate */
      --text-inverse: #F4F1EA;     /* Warm Sand */
      --action-positive: #CC4E3C;  /* Burnt Terracotta */
      --accent-secondary: #2B5F6C; /* Canyon Blue */
      --highlight: #E87A30;        /* Sunburst Orange */
      --border-default: #C8C0B0;   /* Structural Dividers */
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #2A2E2A;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: 'Inter', sans-serif;
      padding: 20px;
    }

    /* IPHONE 17 PRO MAX CONTAINER (Scaled 9:20 Aspect Ratio) */
    .iphone-frame {
      width: 440px;
      height: 956px; /* Reflects 1320x2868 pro max ratio */
      background-color: var(--bg-primary);
      border-radius: 56px;
      border: 12px solid #101210;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px 32px 36px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    /* TOPOGRAPHIC MAP BACKGROUND PATTERN */
    .topo-background {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0.35;
      pointer-events: none;
      background-image: radial-gradient(circle at 50% 30%, transparent 20%, var(--bg-surface) 21%, var(--bg-surface) 22%, transparent 23%),
                        radial-gradient(circle at 50% 30%, transparent 35%, var(--bg-surface) 36%, var(--bg-surface) 37%, transparent 38%),
                        radial-gradient(circle at 50% 30%, transparent 50%, var(--bg-surface) 51%, var(--bg-surface) 52%, transparent 53%),
                        radial-gradient(circle at 50% 30%, transparent 65%, var(--bg-surface) 66%, var(--bg-surface) 67%, transparent 68%),
                        radial-gradient(circle at 50% 30%, transparent 80%, var(--bg-surface) 81%, var(--bg-surface) 82%, transparent 83%);
    }

    /* DYNAMIC ISLAND / STATUS BAR */
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
    }
    .dynamic-island {
      width: 120px;
      height: 32px;
      background-color: #000000;
      border-radius: 20px;
    }

    /* CENTER LOGO & BRANDING ZONE */
    .hero-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      z-index: 10;
      margin-top: 40px;
    }

    .badge-offline {
      background-color: var(--accent-secondary);
      color: var(--text-inverse);
      font-family: 'Oswald', sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1.5px;
      padding: 6px 16px;
      border-radius: 100px;
      text-transform: uppercase;
      margin-bottom: 32px;
      border: 1px solid var(--text-inverse);
    }

    /* PLACEHOLDER GEOMETRIC DISC LOGO */
    .logo-container {
      width: 120px;
      height: 120px;
      background-color: var(--bg-surface);
      border: 3px solid var(--text-primary);
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 24px;
      position: relative;
      box-shadow: 6px 6px 0px var(--border-default);
    }
    .logo-inner {
      width: 80px;
      height: 80px;
      border: 3px dashed var(--accent-secondary);
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 40px;
    }

    .app-title {
      font-family: 'Oswald', sans-serif;
      font-size: 48px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: 2px;
      line-height: 1;
      margin-bottom: 12px;
      text-transform: uppercase;
    }

    .app-subtitle {
      font-family: 'Oswald', sans-serif;
      font-size: 16px;
      font-weight: 500;
      color: var(--text-secondary);
      letter-spacing: 3px;
      text-transform: uppercase;
      max-width: 280px;
      line-height: 1.4;
    }

    /* BOTTOM 40% THUMB INTERACTION ZONE */
    .action-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      z-index: 10;
    }

    .social-proof {
      font-family: 'Oswald', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary);
      background-color: var(--bg-surface);
      padding: 10px 20px;
      border-radius: 8px;
      border-left: 4px solid var(--highlight);
      margin-bottom: 24px;
      width: 100%;
      text-align: center;
      letter-spacing: 0.5px;
    }

    /* PRIMARY BURNT TERRACOTTA CTA BUTTON */
    .btn-primary {
      width: 100%;
      height: 64px;
      background-color: var(--action-positive);
      color: var(--text-inverse);
      font-family: 'Oswald', sans-serif;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      border: 3px solid var(--text-primary);
      border-radius: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      box-shadow: 4px 4px 0px var(--text-primary);
      transition: all 0.1s ease;
      margin-bottom: 20px;
      text-decoration: none;
    }
    .btn-primary:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0px var(--text-primary);
    }

    .link-secondary {
      font-family: 'Oswald', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary);
      text-decoration: underline;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 16px;
      cursor: pointer;
    }

    .link-guest {
      font-family: 'Oswald', sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
      text-decoration: none;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
    }

    /* HOME INDICATOR BAR */
    .home-indicator {
      width: 140px;
      height: 5px;
      background-color: var(--text-primary);
      border-radius: 10px;
      align-self: center;
      margin-top: 10px;
    }
  </style>
</head>
<body>

  <div class="iphone-frame">
    
    <div class="topo-background"></div>

    <div class="status-bar">
      <span>9:41</span>
      <div class="dynamic-island"></div>
      <span>5G 🔋</span>
    </div>

    <div class="hero-zone">
      <div class="badge-offline">⚡ Offline-First Enabled</div>
      
      <div class="logo-container">
        <div class="logo-inner">🥏</div>
      </div>

      <h1 class="app-title">Disc Golf App</h1>
      <p class="app-subtitle">Elevate Your Putting & Inventory</p>
    </div>

    <div class="action-zone">
      <div class="social-proof">
        🔥 142,000+ PUTTS LOGGED THIS WEEK
      </div>

      <a href="#" class="btn-primary">
        Get Started ➔
      </a>

      <span class="link-secondary">Already have an account? Sign In</span>
      <span class="link-guest">[ Explore as Guest / Sandbox ]</span>

      <div class="home-indicator"></div>
    </div>

  </div>

</body>
</html>

1. "Sign in with Apple" (The 1-Tap iOS Gold Standard)

    Why games & top apps use it: If you offer Google SSO on iOS, Apple guidelines explicitly mandate offering Sign in with Apple. In mobile gaming, over 65% of iOS users choose Apple SSO because it requires zero typing—just a glance at FaceID and you’re in.

    How we integrate it: Add a dedicated high-contrast [  Sign in with Apple ] button right beside Google in the Bottom 40% thumb zone.

2. Passwordless "Instant OTP / Magic Code" Toggle

    Why games & top apps use it: Apps like Slack, Discord, and Whoop are ditching passwords entirely. Instead of typing a complex 16-character password in bright sunlight, the user just enters their email and taps "Send 4-Digit Code." They get a push notification/email, tap four giant number blocks, and are instantly logged in.

    How we integrate it: Replace the standard static password box with a smart toggle: [ 🔑 Password ] vs. [ ⚡ Instant 4-Digit Code ].

3. "Claim Your Progress" (Gaming Sandbox Retention)

    Why games & top apps use it: In top mobile games, when you tap "Explore as Guest," the app secretly creates a local shadow profile. If you play a session and decide to create an account later, a banner pops up saying: "🏆 Want to save your 50-putt streak? Link an account now without losing progress."

    How we integrate it: Upgrade the guest link text to read: [ Play Instantly as Guest — Save Progress Later ]. This removes all friction from trying the app.

4. "Always Logged In" Offline Token Guarantee

    Why games & top apps use it: Outdoor athletes worry about getting logged out when they lose cell service in the woods. A visible "365-Day Offline Token" guarantee gives immediate peace of mind.

    How we integrate it: A clean inline checkmark above the main sign-in button: [ ✓ Keep me logged in offline (365 Days) ].

5. Gamified Server / Sync Status Indicator

    Why games & top apps use it: Multiplayer games always display server status on the login screen so you know your cloud saves are ready before you hit play.

    How we integrate it: A small, live-status pill in the top corner: [ 🟢 Supabase Cloud: Online ] (or [ 🟠 Offline Mode Active ]).