I have compiled the entire system architecture into a single, cohesive, end-to-end master document. To guarantee complete structural fidelity, **every single one of the 21 screens** has been expanded to match the exact level of detail, visual hierarchy, ergonomic rules, and ASCII layout standards demonstrated in your reference example.  
This document integrates all design tokens, offline-first Dexie.js database schemas, logic-governance files, and atomic sprint tasks into one definitive blueprint ready for zero-shot execution by Claude Code.

# **MASTER PROJECT BLUEPRINT: DISC GOLF TELEMETRY & PUTTING ECOSYSTEM**

**Document Version:** 2.0.0-PROD (Consolidated Master)  
**Primary Directive:** Offline-First, High-Luminance, Zero-Typing Outdoor Ergonomics  
**Core Stack:** Expo Managed (Universal Web/Native Hybrid), NativeWind v4, Dexie.js (Local-First), TanStack Query (Sync Bridge), Vercel (PWA Hosting), Supabase (PostgreSQL Cloud)

## **SECTION 1: MASTER AGENT RULEBOOK (CLAUDE.md)**

Markdown  
\# CLAUDE.md — Master Agent Rulebook & Engineering Standards  
\*\*Project:\*\* Disc Golf Telemetry & Putting Ecosystem    
\*\*Architecture:\*\* Expo Managed Workflow (Universal Web \+ iOS/Android Hybrid)    
\*\*Deployment:\*\* Vercel (Universal Web / PWA) \+ Supabase (PostgreSQL Cloud)  

\#\#\# 1\. ABSOLUTE MANDATES (ZERO TOLERANCE FOR VIOLATIONS)  
1\. \*\*The Zero-Typing Mandate (Outdoor Field Rules):\*\* Never import or render native OS text keyboards (\`\<TextInput\>\`, \`\<textarea\>\`) on active field execution screens (Screens 4 through 21). All user interactions MUST occur via 48px+ touch targets, horizontal choice chips, segmented grids, or bottom-sheet drawers.  
2\. \*\*Local-First Persistence:\*\* Never make direct write or read calls to Supabase from UI components. ALL database CRUD operations MUST mutate our local \*\*Dexie.js (IndexedDB/SQLite)\*\* instance first. Cloud synchronization happens strictly asynchronously in the background via TanStack Query when network connectivity (\`navigator.onLine\`) is confirmed.  
3\. \*\*High-Luminance Solar Glare Defense:\*\* Clinical white (\`\#FFFFFF\`) and pure black (\`\#000000\`) are banned for UI containers and text. You must strictly enforce the \*\*Sun-Drenched Topo (Oswald Edition)\*\* hex design tokens defined below.  
4\. \*\*Vertical-Only Progression:\*\* Do not implement horizontal scrolling on primary screen containers. All secondary catalog browsing or bag navigation must use horizontal cards or vertical accordion expansion.  
5\. \*\*No Tiered Gating:\*\* There are no Free or Premium tiers. All users have unrestricted access to unlimited bags, custom routines, audio coaching, and CSV export.

\#\#\# 2\. COMMAND PROTOCOLS & TOOLING  
\`\`\`bash  
\# Package Management (Strictly use pnpm)  
pnpm install

\# Local Development Server (Expo Universal)  
pnpm exec expo start

\# Run Unit & Domain Math Tests (Jest \+ React Native Testing Library)  
pnpm test

\# Run End-to-End Field Execution Flows (Maestro)  
pnpm test:e2e

\# Type Checking & Linting  
pnpm tsc \--noEmit && pnpm eslint . \--ext .ts,.tsx

### **3\. DESIGN TOKENS & NATIVEWIND CONFIGURATION**

JavaScript  
// tailwind.config.js snippet  
module.exports \= {  
  theme: {  
    extend: {  
      colors: {  
        bg: {  
          primary: '\#F4F1EA',    // Warm Sand / Parchment (Main backgrounds)  
          surface: '\#E2DED4',    // Desert Clay (Card containers, steppers)  
          alt: '\#D6CEBF'         // Deep Sand (Pressed states, dividers)  
        },  
        text: {  
          primary: '\#1A1D1A',    // Deep Slate (High-contrast text & borders)  
          secondary: '\#4A524A',  // Muted Slate (Sub-labels, metadata)  
          inverse: '\#F4F1EA'     // Warm Sand (Text inside saturated buttons)  
        },  
        action: {  
          positive: '\#CC4E3C',   // Burnt Terracotta (Primary CTAs, Made putts)  
          secondary: '\#2B5F6C',  // Canyon Blue (Context bars, active tabs)  
          negative: '\#8C2D19',   // Deep Rust (Missed putts, destructive actions)  
          highlight: '\#E87A30'   // Sunburst Orange (Streak badges, milestones)  
        },  
        border: {  
          default: '\#C8C0B0',    // Structural dividers  
          focus: '\#1A1D1A'       // Solid active focus rings  
        }  
      },  
      fontFamily: {  
        oswald: \['Oswald', 'sans-serif'\], // All headers, CTAs, numbers  
        inter: \['Inter', 'sans-serif'\]    // Body and tabular data  
      }  
    }  
  }  
}

\---

\#\# SECTION 2: PRODUCT & ARCHITECTURAL VISION (\`PRD.md\` & \`TECH\_STACK.md\`)

\`\`\`markdown  
\# PRD.md — Product Requirements Document  
\*\*Core Problem:\*\* Standard sports telemetry apps fail on outdoor disc golf courses due to solar glare washout, touchscreen keyboard friction with muddy/sweaty hands, and cellular dead zones.    
\*\*Target Persona:\*\* Ryan (38, MA2/MPO competitive tournament golfer). Needs instant 1-tap routine execution, eyes-free audio/haptic feedback, and empirical data proving whether tactical gear swaps save strokes.    
\*\*Core Guarantees:\*\* 100% unrestricted access (no paywalls), 365-day offline autonomy via Dexie.js, and a self-driving coaching engine.    
\*\*Success Metrics:\*\* \<3s time-to-action via Hero Card, 0% keyboard invocation during scoring, \<50ms haptic latency, and zero data loss during background sync.

\# TECH\_STACK.md — Technical Architecture  
\*\*Hosting & CDN:\*\* Vercel Edge Network (Universal Web / PWA via Workbox service worker shell caching).    
\*\*Cloud Database & Auth:\*\* Supabase (PostgreSQL 16+ \+ GoTrue Auth).    
\*\*Local Persistence:\*\* Dexie.js (IndexedDB for Web / SQLite for Native via Expo).    
\*\*Replication Loop:\*\* UI mutates Zustand ephemeral state $\\rightarrow$ writes immediately to Dexie.js $\\rightarrow$ TanStack Query (\`networkMode: 'offlineFirst'\`) queues payloads in \`sync\_queue\` $\\rightarrow$ background worker pushes to Supabase REST endpoints upon cellular restoration.    
\*\*Hardware Bridges:\*\* \`expo-haptics\` (scoring pulses), Web Speech API \+ \`expo-speech\` (audio coach), \`lz-string\` \+ \`react-native-qrcode-svg\` (offline QR Beam).

## **SECTION 3: THE COMPLETE 21-SCREEN MASTER ARCHITECTURE**

### **MODULE 1: CORE FOUNDATION & ONBOARDING**

#### **Screen 1: Welcome Landing (WelcomeLandingView)**

Establishes high-impact visual branding, communicates immediate offline-first trust, and routes users to authentication or instant guest exploration without cognitive clutter.

##### **1\. Ergonomic & Visual Architecture**

* **Offline-First Trust Badge:** A persistent Canyon Blue (\#2B5F6C) pill badge at top center reading ⚡ OFFLINE-FIRST ENABLED, reassuring outdoor athletes that course connectivity is not required.  
* **Dynamic Social Proof Ticker:** An elevated Desert Clay (\#E2DED4) surface container displaying live aggregated metrics (e.g., 🔥 142,000+ PUTTS LOGGED THIS WEEK) in bold Oswald typography.  
* **Primary Action Target (GET STARTED ➡️):** A massive 64px height Burnt Terracotta (\#CC4E3C) button anchored strictly in the bottom 40% thumb zone for effortless 1-tap activation.  
* **Guest Sandbox Escape Hatch:** An inline high-contrast text link below the primary CTA that bypasses account creation entirely, routing directly to Screen 3 while initializing an anonymous local Dexie.js shadow database.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ( 🥏 ) DISC GOLF APP           \[⚡ OFFLINE ENABLED\]  | \<- Canyon Blue Badge (\#2B5F6C)  
\+-------------------------------------------------------+  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  |           GEOMETRIC TELEMETRY LOGO              |  |  
|  |           (Circular Circuit Pattern)            |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  DISC GOLF APP                                        | \<- Oswald Bold, Deep Slate  
|  ELEVATE YOUR PUTTING & INVENTORY                     |  
|                                                       |  
|=================== BOTTOM 40% ZONE \===================|  
|  🔥 142,000+ PUTTS LOGGED THIS WEEK                   | \<- Desert Clay Container (\#E2DED4)  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  |             GET STARTED   \[➔\]                   |  | \<- Burnt Terracotta (\#CC4E3C)  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  Already have an account? Sign In                     |  
|  \[ Play Instantly as Guest — Save Progress Later \]    | \<- Instant Dexie Shadow Profile  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 2: Account Authentication & Recovery (AuthRecoveryView)**

Eliminates the \#1 cause of outdoor app abandonment by replacing complex password typing in bright sunlight with passwordless SMS OTP entry and 1-tap biometric social SSO.

##### **1\. Ergonomic & Visual Architecture**

* **Segmented Auth Toggle:** A high-contrast 2-way toggle pill in Desert Clay (\#E2DED4) switching between \[ SIGN IN \] and \[ CREATE ACCOUNT \] without altering layout height.  
* **Passwordless 4-Digit OTP Blocks:** Replaces standard text boxes with four giant 56px numeric touch blocks. Integrates with the native Web OTP API to auto-paste incoming SMS codes without keyboard popping.  
* **1-Tap Biometric SSO Row:** Large, side-by-side Canyon Blue (\#2B5F6C) touch targets for \[  Apple \] and \[ G Google \], leveraging native FaceID/TouchID handshakes.  
* **365-Day Offline Guarantee Checkbox:** A selected-by-default Muted Sand (\#D6CEBF) toggle extending local JWT expiration in Dexie.js to prevent remote course logouts.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ( 🥏 ) DISC GOLF APP        \[🟢 CLOUD SYNC: READY\]  |  
\+-------------------------------------------------------+  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | \[  SIGN IN  \] (Active)    |    \[ CREATE ACCOUNT \]|  | \<- Desert Clay Toggle (\#E2DED4)  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  EMAIL ADDRESS                                        |  
|  \+-------------------------------------------------+  |  
|  | ✉️  athlete@discgolfapp.com                     |  | \<- 48px Touch Target  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ENTRY METHOD                                         |  
|  \+-------------------------------------------------+  |  
|  | \[ ⚡ 4-Digit Code \] (Active) | \[ 🔑 Password \]  |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | \[ 1 \]   \[ 4 \]   \[ 2 \]   \[ 8 \]   (Paste from SMS)|  | \<- Giant 56px OTP Blocks  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \[ ✓ \] Keep me logged in offline (365-Day Guarantee)  | \<- Extended Local JWT  
|                                                       |  
|=================== BOTTOM 40% ZONE \===================|  
|  \+-------------------------------------------------+  |  
|  |              INSTANT SIGN IN   \[➔\]              |  | \<- Burnt Terracotta (\#CC4E3C)  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \+------------------------+ \+----------------------+  |  
|  | \[  \] APPLE SIGN IN    | | \[ G \] GOOGLE SIGN IN |  | \<- Canyon Blue (\#2B5F6C)  
|  \+------------------------+ \+----------------------+  |  
|                                                       |  
|   \[ Play Instantly as Guest — Save Progress Later \]   |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 3: 3-Step Zero-Typing Onboarding Wizard (OnboardingWizardView)**

Calibrates athlete profile data, establishes an initial putting inventory, and trains physical haptic feedback recognition in under 60 seconds without invoking an OS keyboard.

##### **1\. Ergonomic & Visual Architecture**

* **Step 1 — Goal Selector Cards:** Three massive horizontal selection cards (\[ 🎯 Dial In Consistency \], \[ 🎒 Bag Management \], \[ 📊 Deep Analytics \]) that tag the user profile in Dexie.js to customize default dashboard layouts.  
* **Step 2 — Putter Provisioning Stepper:** A brand choice chip row (MVP | Axiom | Streamline) coupled with mold cards and a numeric weight stepper (\[ \- \] 174g \[ \+ \]). Auto-defaults to the **Axiom Cosmic Pilot (174g)** and initializes a 10-disc "Practice Stack" bag in local storage.  
* **Step 3 — Sensory Calibration & Unit Selector:** Features a giant 64px touch target reading \[ 📳 TAP TO TEST SCORING PULSE \] that fires navigator.vibrate(\[50, 50, 50\]) to train the thumb for eyes-free scoring, alongside segmented choice chips for \[ FEET \] vs. \[ METERS \].

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  \[████████████████████████░░░░░░░░░░░░\]  STEP 2 OF 3  | \<- Canyon Blue Progress Bar  
\+-------------------------------------------------------+  
|  SELECT YOUR PRIMARY PUTTER                           | \<- Oswald Bold, Deep Slate  
|  WE'LL AUTO-BUILD YOUR INSTANT PRACTICE STACK.        |  
|                                                       |  
|  1\. BRAND SELECTOR                                    |  
|  \+-------------------------------------------------+  |  
|  | \[ MVP \]   \[ AXIOM \] (Active)  \[ STREAMLINE \]    |  | \<- Segmented Horizontal Grid  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  2\. SELECT MOLD                                       |  
|  \+-------------------------------------------------+  |  
|  | (●) COSMIC PILOT (Electron)      \[★ DEFAULT \]   |  | \<- Desert Clay Container  
|  \+-------------------------------------------------+  |  
|  | ( ) ENVY  (Electron Firm / Plasma)              |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  3\. WEIGHT IN GRAMS                                   |  
|  \+-------------------------------------------------+  |  
|  |  \[ \- \]       \[  174g  \] (Active)       \[ \+ \]    |  | \<- Zero-Typing Numeric Stepper  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 40% ZONE \===================|  
|  \[ ✓ \] SET AS PRIMARY PUTTER & CREATE STACK           |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  |           CONFIRM & CONTINUE   \[➔\]              |  | \<- Burnt Terracotta (\#CC4E3C)  
|  \+-------------------------------------------------+  |  
|         \[ Skip Setup — I'll Configure Later \]         |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

### **MODULE 2: HUBS & INVENTORY CURATION**

#### **Screen 4: Main Dashboard Hub & Routine Launchpad (DashboardHubView)**

Serves as the high-speed launchpad prioritizing immediate putting execution over administrative navigation, while consolidating standard curated drills and custom layouts into a unified 3-way filtered workspace.

##### **1\. Ergonomic & Visual Architecture**

* **Top Header & Streak Badge:** Displays a Sunburst Orange (\#E87A30) 🔥 4-DAY STREAK pill badge. Tapping invokes a modal detailing historical consistency milestones.  
* **Zone A — Immediate Action Hero Card:** Saturated Burnt Terracotta (\#CC4E3C) container reading the last-executed routine from Dexie.js (▶️ RESUME: MORNING C1 CALIBRATION). A single tap mounts Screen 8 directly in under 3 seconds.  
* **Zone B — 3-Way Routine Launchpad:** A Desert Clay (\#E2DED4) segmented filter toggling between \[ ★ STANDARD (5) \], \[ 🛠️ CUSTOM \], and \[ ➕ NEW \]. Standard cards display total putts and include a secondary Canyon Blue (\#2B5F6C) button: \[ 👯 CLONE & TWEAK \] to duplicate presets into Screen 7 instantly.  
* **Zone C — Custom Planning Drawer:** An outline trigger block at the base of the list that slides up a bottom sheet for numeric stepper adjustments without leaving the hub.  
* **Standardized 4-Tab Navigation Bar:** Anchored at 56px height in Desert Clay (\#E2DED4) with Deep Slate (\#1A1D1A) icons for \[ 🏠 PLAY \], \[ 💼 BAGS \], \[ 📊 STATS \], and \[ 👤 PRO \].

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ( 🥏 ) PUTT HUB           🔥 4-DAY STREAK      \[⚙️\]  | \<- Top Global Header  
\+-------------------------------------------------------+  
|  ⚡ ZONE A: IMMEDIATE ACTIONS                          |  
|  \+-------------------------------------------------+  |  
|  |  ⚡ QUICK START: FREE PLAY                       |  | \<- Saturated Action Block  
|  |     Continuous scoring tracking • No limits     |  |    Direct 1-tap setup  
|  \+-------------------------------------------------+  |  
|  |  ▶️ RESUME LAST: C1 CALIBRATION LADDER (40)      |  | \<- Burnt Terracotta Hero Card  
|  |     Target: Axiom Cosmic Pilot 174g             |  |    Loads last state instantly  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  📚 ZONE B: GUIDED ROUTINES LAUNCHPAD                 |  
|  \+-------------------------------------------------+  |  
|  | \[★ STANDARD \](Actv) | \[🛠️ CUSTOM(3)\] | \[ ➕ NEW \] |  | \<- 3-Way Segmented Filter  
|  \+-------------------------------------------------+  |  
|  | 🪜 1\. C1 CALIBRATION LADDER    \[ 40 / 100 PUTTS \]|  | \<- Structural Surface Cards  
|  |    Stages: 15ft ➔ 20ft ➔ 25ft ➔ 33ft            |  |    Deep Slate borders  
|  |    \[ ▶️ LAUNCH \]             \[ 👯 CLONE & TWEAK \] |  | \<- Large touch sub-targets  
|  \+-------------------------------------------------+  |  
|  | 💯 2\. THE CENTURY CLUB         \[ 100 / 100 MAX \]|  | \<- Enforces 100-Putt Ceiling  
|  |    Stages: 5x 20-Putt Fatigue Blocks            |  |  
|  |    \[ ▶️ LAUNCH \]             \[ 👯 CLONE & TWEAK \] |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🛠️ ZONE C: PLANNING & CREATION                       |  
|  \+-------------------------------------------------+  |  
|  |  ➕ BUILD CUSTOM ROUTINE LADDER                  |  | \<- Secondary Outline Button  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  | \<- Standardized Active Tab  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 5: Unified Bag Management & Disc Universe Hub (BagManagerView)**

Merges personal tournament bag organization and global catalog browsing into a zero-scrollbar workspace that enforces real-world PDGA carrying limits and guides shopping intent.

##### **1\. Ergonomic & Visual Architecture**

* **3-Way Segmented Header:** High-contrast Desert Clay (\#E2DED4) toggle switching between \[ MY BAGS \], \[ 🎯 PUTTERS \], and \[ UNIVERSE \].  
* **35-Disc Capacity Interlock:** Dynamic progress bar monitoring total discs. Displays Canyon Blue (\#2B5F6C) at 0–29 discs $\\rightarrow$ Sunburst Orange (\#E87A30) at 30–34 discs $\\rightarrow$ Deep Rust (\#8C2D19) warning at 35 discs. At 35 discs, all \[ \+ Add to Bag \] buttons disable and turn gray (\#C8C0B0).  
* **3-Tier Vertical Accordion Catalog:** Browsing the *Disc Universe* expands strictly downward (Mold $\\rightarrow$ Plastic $\\rightarrow$ Specific Run), eliminating horizontal scrolling. Tapping a run slides up a weight selection drawer.  
* **Ghost Slot Wishlist Generator:** When analytics detect a stability gap (e.g., lacking an overstable utility disc), a dashed Desert Clay card is injected: \[ \+ 👻 GHOST SLOT: MVP DEFLECTOR • Speed 5 / Fade 4 \]. Tapping \[ FIND \] opens Screen 17 pre-filtered to retail options.  
* **QR Beam P2P Share (\[ 🔗 BEAM QR \]):** Compresses the 35-disc bag array using lz-string into an on-screen QR code. Peers can scan and clone the bag into their local Dexie.js database instantly without cellular service.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  💼 BAG MANAGEMENT       \[ 🔗 BEAM QR \] \[ \+ NEW BAG \] | \<- Offline P2P Clone  
\+-------------------------------------------------------+  
|  \+-------------------------------------------------+  |  
|  | \[ MY BAGS \] | \[🎯 PUTTERS \] | \[ UNIVERSE \](Actv)|  | \<- 3-Way Segmented Header  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🎒 ACTIVE BAG: MAIN TOURNEY BAG (19 / 35 DISCS)      |  
|  \[████████████████████░░░░░░░░░░░░░░░\] 54% CAPACITY   | \<- Capacity Interlock Bar  
|                                                       |  
|  ▼ 1\. MOLD: AXIOM COSMIC PILOT \[ 2/5/0/1 \] (Putter)   | \<- Tier 1 Expanded  
|  \+-------------------------------------------------+  |  
|  | ▼ PLASTIC: ELECTRON FIRM        \[ 3 RUNS AVAIL \]|  | \<- Tier 2 Expanded  
|  |   \+-------------------------------------------+ |  |  
|  |   | • 2026 Cosmic Stock Run  \[ \+ ADD TO BAG \] | |  | \<- 48px Action Target  
|  |   \+-------------------------------------------+ |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \--- 💡 RECOMMENDATION: GAP DETECTED IN LINEUP \---    |  
|  \+ \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \+  |  
|  | \+ 👻 GHOST SLOT: MVP DEFLECTOR \[ 5 / 3 / 0 / 4 \]|  | \<- Dashed Wishlist Card  
|  |   You lack an overstable utility mid. \[ FIND \]  |  |    Bridges to Screen 17\!  
|  \+ \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \- \+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  |  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 6: Putter Lineup Manager & Live Flight Curve Editor (PutterLineupView)**

Isolates putting assets for rapid field swapping and visually models aerodynamic flight degradation based on real-world plastic wear and tear.

##### **1\. Ergonomic & Visual Architecture**

* **Swimlane Hierarchy Assignments:** Organizes putting inventory into three explicit tiers: 👑 Primary Putter (Max 1), 🥈 Backup Stack (Unlimited), and ⚠️ Situational Weather Putters (Capped at 3), dictating which discs appear in rapid-swap drawers during active field scoring.  
* **Sticky 2D SVG Bézier Flight Canvas:** Top 35% visualizer rendering two simultaneous aerodynamic curves across a distance grid ($0$ to $350\\text{ ft}$): a dotted gray factory baseline vs. a solid Canyon Blue (\#2B5F6C) custom reality trajectory.  
* **1-to-10 Wear & Tear Slider:** Tactile horizontal slider in Desert Clay (\#E2DED4). Dragging left toward 1.0 (Beaten-In) scales the disc's Turn lower and decreases Fade in real time at 60fps on the SVG canvas.  
* **Automated Odometer Alert:** When a base-plastic disc crosses **300 logged putts** in Dexie.js, an alert box inserts above the slider: 🎯 312 Putts Logged\! Auto-adjust Wear Score from \[ 7/10 \] ➔ \[ 6/10 \]?. Tapping \[ APPLY \] executes mathematical degradation automatically.  
* **Equipment Retirement Workflow (\[ ⚰️ RETIRE ASSET \]):** Moves broken or lost putters to an archived database state, preserving lifetime stats in the Career Hub while removing them from active rotation.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  COSMIC PILOT \[ 2 / 5 / 0 / 1 \]     \[ ⚰️ RETIRE \] | \<- Top Header with Retire CTA  
\+-------------------------------------------------------+  
|   Distance (Ft)   \[ TOP 35% STICKY SVG CANVAS \]       |  
|    350 \+------------------------------------------+   |  
|        |                   . . .                  |   | \<- Dotted \= Factory Default  
|    175 |                .       /                 |   | \<- Solid Blue \= Custom Reality  
|        |               .       / |                |   |    (Adjusted for Wear Score)  
|      0 \+---------------+---------+----------------+   |  
|       \-50              0         50   Stability       |  
\+-------------------------------------------------------+  
|  🗖 REAL-TIME FLIGHT CURVE & WEAR EDITOR              |  
\+-------------------------------------------------------+  
|  1\. MECHANICAL WEAR & TEAR SLIDER (SCALE: 1 TO 10\)    |  
|  Beaten-In  |--------------●-----------|  Overstable  | \<- Currently set to 7/10  
|                                                       |  
|  \--- 🛠️ AUTOMATED ODOMETER ALERT (DEXIE.JS) \------    |  
|  \+-------------------------------------------------+  |  
|  | 🎯 312 PUTTS LOGGED ON THIS ASSET               |  |  
|  | Base Electron plastic detected. Auto-adjust     |  |  
|  | Wear Score from \[ 7/10 \] ➔ \[ 6/10 \]?  \[ APPLY \] |  | \<- 1-Tap Mathematical Update  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  2\. MANUAL FLIGHT NUMBER OVERRIDES                    |  
|  \+-----------+  \+-----------+  \+-----------+  \+-----+ |  
|  | SPD: \[ 2\] |  | GLD: \[ 5\] |  | TRN: \[  0\]| |FD:1 | | \<- Touch Blocks (No Keyboard)  
|  \+-----------+  \+-----------+  \+-----------+  \+-----+ |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

### **MODULE 3: FIELDWORK TRAINING & EXECUTION ENGINE**

#### **Screen 7: Custom Routine Builder (RoutineBuilderView)**

Allows athletes to engineer complex, multi-stage putting ladders in under 45 seconds using progressive disclosure and strict safety interlocks.

##### **1\. Ergonomic & Visual Architecture**

* **Modular Stage Cards:** Stackable containers representing individual distance routines (up to 20 stages). Stage 1 auto-populates with smart defaults ($20\\text{ ft}$, $10\\text{ putts}$).  
* **Segmented Horizontal Steppers:** Replaces error-prone dropdown menus with massive touch grids for Distance (15', 20', 25', 33' C1) and Putt Increments (5, 10, 15, 20).  
* **Milestone Bonus Toggles:** Four 48px touch chips per stage (\[✓ First\], \[✓ Last\], \[✓ Streak\], \[✓ Clean\]) enabling weighted scoring multipliers to simulate tournament pressure.  
* **100-Putt Hard Ceiling Interlock:** Persistent summary totalizer anchored above the primary CTA (Routine Summary: 4 Stages | 40 / 100 Putts Max). If a stage push exceeds 100 putts, the \[ ➕ ADD NEXT STAGE \] button dynamically disables and turns gray (\#4A524A) to prevent arm fatigue and database logging latency.  
* **QR Beam Routine Share (\[ 🔗 BEAM \]):** Generates a compressed offline QR code allowing peers at the practice basket to clone the training routine in seconds.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  BUILD CUSTOM ROUTINE       \[ 🔗 BEAM \]    \[ ✕ \]  | \<- Top Header  
\+-------------------------------------------------------+  
|  ROUTINE NAME: \[ MORNING C1 CALIBRATION          \] ✏️ | \<- Zero-Typing Preset Picker  
\+-------------------------------------------------------+  
|  📍 STAGE 1 (ACTIVE)                           \[ 🗑️ \] |  
|  \+-------------------------------------------------+  |  
|  | DISTANCE TARGET                                 |  |  
|  | \[ 15ft \]  \[ 20ft \](Actv)  \[ 25ft \]  \[ 33ft/C1 \] |  | \<- Horizontal Segmented Grid  
|  |                                                 |  |  
|  | PUTTS IN STAGE (INCREMENTS OF 5\)                |  |  
|  | \[  5  \]   \[ 10 \](Actv)    \[ 15 \]    \[ 20 \]      |  |  
|  |                                                 |  |  
|  | MILESTONE BONUS TOGGLES                         |  |  
|  | \[✓ First\]   \[✓ Last\]   \[✓ Streak\]   \[✓ Clean\]   |  | \<- Burnt Terracotta Active State  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ➕ ADD NEXT STAGE (DUPLICATES STAGE 1 SETTINGS)      | \<- Disables if total \> 100  
|                                                       |  
|=================== BOTTOM 40% ZONE \===================|  
|  📊 ROUTINE SUMMARY: 1 STAGE | 10 / 100 PUTTS MAX     | \<- Sticky Totalizer Footer  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  |             💾 SAVE & LAUNCH ROUTINE            |  | \<- Burnt Terracotta (\#CC4E3C)  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 8: Rapid-Fire Scoring Canvas & Mid-Round Swaps (ScoringCanvasView)**

Serves as the core execution engine requiring zero visual focus to operate, allowing athletes to maintain 100% eye contact with the chains while scoring 50+ putts.

##### **1\. Ergonomic & Visual Architecture**

* **50% Split-Screen Tactile Scoring Zones:** Lower half of display partitioned vertically into two unmistakable touch targets:  
  * **Left Zone (\[ MADE \]):** Framed with solid green border. Tapping anywhere logs a successful putt to Dexie.js and fires a crisp **50ms native haptic vibration pulse** (navigator.vibrate(50)).  
  * **Right Zone (\[ MISSED \]):** Framed with solid Deep Rust (\#8C2D19) border. Tapping logs a miss, resets streak counter, and fires a distinct **heavy double-vibration pulse** (navigator.vibrate(\[100, 50, 100\])).  
* **Visual Stack Tracker:** Top-zone geometric array representing remaining discs in the physical stack. Diamonds (◆) flag weighted First/Last bonus targets; Circles (●) flag standard putts. Flashes Vibrant Green or Matte Red upon scoring taps.  
* **Web Speech API Audio Coach:** Tapping \[ 🎙️ AUDIO: ON \] activates voice pacing (*"Stage 2\. 20 feet. 10 putts. Begin."*) and acoustic chimes (chain ring for make, dull thud for miss) so the phone can remain on the ground.  
* **Bag-to-Weather Auto-Suggest Engine:** Tapping top \[ 🌬️ Weather ▾ \] pill opens a lower drawer. Selecting **18MPH Headwind** or **Rain** triggers an inline banner: 💡 18MPH HEADWIND DETECTED\! Your Proton Pilot will flip. Swap to assigned backup: Streamline Stabil? \[ YES, SWAP \]. Tapping \[ YES \] mutates activePutterId instantly.  
* **Ad-Hoc Asset Substitution & Batch Editing (\[ 🔄 SWAP \] / \[ 📝 EDIT \]):** Allows immediate asset switching if a putter is damaged mid-set, and manual integer overrides for the current stage if a practice burst was miscounted.  
* **Low Battery / Cold Hands Panic Toggle:** Accessible via top header; converts entire screen into a single high-contrast touch zone (Tap anywhere \= Made, Long-press \= Missed).

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  STAGE 2: 20 FEET   |  \[ 15/40 \]  |  \[ 🎙️ AUDIO: ON \]| \<- Audio Coach & Pacer  
\+-------------------------------------------------------+  
|   (◆)    (●)    (●)    (●)    (◆)                     | \<- Stack Tracker (Green/Red)  
|  First         Streak         Last                    |  
|                                                       |  
|  \+-----------------------+  \+----------------------+  |  
|  | \[ 🥏 PILOT (PRM) 🔄 \]  |  | \[ 🌬️ 18MPH WIND ▾ \]  |  | \<- Ad-Hoc Swap & Wind Selector  
|  \+-----------------------+  \+----------------------+  |  
|                                                       |  
|  \--- 💡 ENVIRONMENTAL SYNERGY DETECTED \-----------    |  
|  \+-------------------------------------------------+  |  
|  | ⚠️ 18MPH HEADWIND WILL FLIP YOUR ELECTRON PILOT\!|  |  
|  | Swap to assigned backup: Streamline Stabil?     |  |  
|  | \[ ➔ YES, SWAP FOR STAGE 2 \]      \[ IGNORE \]     |  | \<- 2-Tap Tactical Adaptation  
|  \+-------------------------------------------------+  |  
|                                                       |  
|================= LOWER 50% SCORING ZONE \==============|  
|                           |                           |  
|                           |                           |  
|          MADE             |          MISSED           | \<- Massive Split-Screen Targets  
|       (TAP LEFT)          |        (TAP RIGHT)        |    (Zero Typing / Eyes Free)  
|     \[ 50ms Pulse \]        |     \[ Double Pulse \]      |  
|                           |                           |  
|---------------------------+---------------------------|  
|  \[ ↩️ UNDO \]   \[ 📝 EDIT \]   🔥 STREAK: 4   🎁 BONUS  | \<- Batch Edit Shortcut  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 9: Session Summary & Progress Report (SessionSummaryView)**

Delivers immediate post-workout diagnostic intelligence without visual clutter, proving whether situational gear swaps actually improved conversion rates.

##### **1\. Ergonomic & Visual Architecture**

* **High-Luminance Hero Scoreboard:** An elevated container in Desert Clay (\#E2DED4) featuring massive Oswald numbers in Deep Slate (\#1A1D1A) for overall accuracy (🟢 42 / 50 PUTTS MADE) and peak streak tracking.  
* **Putter Performance Breakdown:** Isolates accuracy percentage by exact physical disc asset. If a user swapped from an Electron Pilot to a headwind-resistant Streamline Stabil mid-session, this card audits whether that tactical switch succeeded.  
* **Distance Drop-Off Matrix:** Compares today's conversion rate against the user's rolling 30-day baseline. Dipping more than 10% below baseline at a specific distance (e.g., Circle 1 edge / $33\\text{ ft}$) triggers a prominent Deep Rust (\#8C2D19) warning badge ⚠️.  
* **Post-Session Celebration Overlay:** If an XP threshold was crossed or an achievement badge was unlocked during the session, a high-luminance animated banner slides down before stats load: 🎉 LEVEL UP\! YOU ARE NOW LEVEL 35 (+500 XP\!).  
* **Dual-Action Footer (48px Touch Height):** Two full-width buttons: \[ 🔄 REPLAY ROUTINE \] (resets scores, keeps routine settings, and immediately drops onto Stage 1\) and \[ 🏠 DASHBOARD \] (saves session to local IndexedDB and exits).

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  🏆 SESSION COMPLETE: MORNING C1 LADDER        \[ ⚙️ \] | \<- Oswald Bold, Deep Slate  
\+-------------------------------------------------------+  
|  🎉 LEVEL UP\! YOU ARE NOW LEVEL 35 (+500 XP EARNED\!)  | \<- Celebration Banner  
|  🏆 NEW TROPHY UNLOCKED: 🤖 C1 AUTOMATIC \[ INSPECT \]   |  
\+-------------------------------------------------------+  
|  OVERALL ACCURACY SCOREBOARD                          | \<- Desert Clay Container (\#E2DED4)  
|  \+-------------------------------------------------+  |  
|  |  🟢 42 / 50 PUTTS MADE        🔥 STREAK PEAK: 14|  |  
|  |  \[██████████████████████████████░░░░░\] 84%      |  | \<- Progress Bar, Terracotta (\#CC4E3C)  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🥏 PUTTER PERFORMANCE BREAKDOWN                      |  
|  \+-------------------------------------------------+  |  
|  | 👑 Pilot (Cosmic)   \[████████████████████░░░\]86%|  | \<- 24/28 Putts (Primary)  
|  | 🥈 Pilot (Electron) \[████████████████░░░░░░\] 73%|  | \<- 11/15 Putts (Backup)  
|  | ⚠️ Stabil (Proton)  \[█████████████████████\]100%|  | \<- 7/7 Putts (Headwind Swap\!)  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🎯 DISTANCE BREAKDOWN MATRIX VS. 30-DAY BASELINE     |  
|  \+-------------------------------------------------+  |  
|  | 15ft: 10/10 (100%) \[ \+0% \] | 20ft: 18/20 (90%)  |  |  
|  | 25ft:  9/10 (90%)  \[ \+5% \] | 33ft:  5/10 (50%)⚠️|  | \<- ⚠️ Alerts \>10% drop vs baseline\!  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🎁 MILESTONE & BONUS RECAP                           |  
|  \+-------------------------------------------------+  |  
|  | ⭐ First Putt Bonus: 4 / 4 Stages Cleared        |  |  
|  | 🔥 Clean Sweep:      Stage 1 (15ft) Perfect     |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 40% ZONE \===================|  
|  \+-------------------------------------------------+  |  
|  |          🔄 REPLAY ROUTINE   \[➔\]                |  | \<- Burnt Terracotta (\#CC4E3C)  
|  \+-------------------------------------------------+  |  
|  \+-------------------------------------------------+  |  
|  |          🏠 DASHBOARD                           |  | \<- Canyon Blue (\#2B5F6C)  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

### **MODULE 4: ANALYTICS, PROGRESSION & INGESTION**

#### **Screen 10: Global Analytics & Settings Control Tower (AnalyticsControlView)**

Serves as the long-term performance trend hub and local database management center, giving athletes total transparency over their data portability and offline storage health.

##### **1\. Ergonomic & Visual Architecture**

* **Time-Series Accuracy Chart with Milestone Injections:** Interactive SVG line chart tracking Circle 1 putting percentages over \[ 7 DAYS \], \[ 30 DAYS \], or \[ 90 DAYS \] choice chips. When an athlete assigns a new Primary Putter on Screen 6, the database logs an equipment timestamp. The SVG rendering engine automatically injects a vertical star marker (★) onto the timeline at that exact date, providing undeniable visual proof of equipment correlation.  
* **Local Dexie.js Storage & Cloud Sync Control Row:** Displays exact state of offline data (Status: \[ ✓ 450 Logs Saved Locally \]). Includes a prominent \[ 🔄 SYNC NOW \] button to force immediate cloud replication when connected to Wi-Fi, alongside an auto-sync cellular data toggle.  
* **Scoring & Biometric Behavioral Toggles:** Instant zero-typing switches for display units (Feet vs. Meters), default practice stack sizing (5 | 10 | 15 discs), haptic vibration feedback, and hands-free audio voice registration.  
* **Wearables & Sensors Link (\[ ⌚ WEARABLES HUB \]):** Dedicated shortcut card bridging directly to Screen 16 for watchOS companion and IoT sensor configuration.  
* **Data Portability & Cache Guardrails:**  
  * **\[ 📥 EXPORT LOCAL LOGS TO CSV \]:** Compresses all local Dexie.js tables into a standard .csv string and invokes native iOS/Android OS share sheets, ensuring the athlete owns their data 100%.  
  * **\[ 🔴 CLEAR CACHE & LOCAL STORAGE \]:** Rendered in Deep Rust (\#8C2D19). Tapping invokes a strict 2-step verification modal requiring non-overlapping confirmation block taps to prevent accidental deletion of unsynced offline practice history.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  📊 ANALYTICS & PREFERENCES                    \[ ✕ \]  | \<- Top Header  
\+-------------------------------------------------------+  
|  📈 C1 ACCURACY TRENDS (TIME-SERIES)                  |  
|  \+-------------------------------------------------+  |  
|  | \[ 7 DAYS \]     \[ 30 DAYS \](Actv)     \[ 90 DAYS \]|  | \<- Segmented Filter  
|  |                                                 |  |  
|  |  100% \+--------------------------------------+  |  |  
|  |       |        . . .  ★ \<--- Swapped to Pilot\!|  | \<- ★ Milestone marker proves exact  
|  |   75% |     . .       . . . . . . . .        |  |    date equipment changed\!  
|  |       |   .                     |           |  |  
|  |   50% \+---+---------+-----------+------------+  |  |  
|  |      Wk 1      Wk 2        Wk 3        Wk 4     |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🛜 LOCAL DEXIE.JS STORAGE & SUPABASE SYNC            |  
|  \+-------------------------------------------------+  |  
|  | Status: \[ ✓ 450 Logs Saved Locally \]            |  |  
|  | \[ 🔄 SYNC NOW TO CLOUD \]  \[✓\] Auto-Sync on Cell |  | \<- TanStack Query Trigger  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🎯 FIELD SCORING BEHAVIORS & WEARABLES               |  
|  \+-------------------------------------------------+  |  
|  | UNITS:       \[ FEET \](Actv)  \[ METERS \]         |  |  
|  | STACK SIZE:  \[  5  \]         \[  10  \](Actv) \[15\]|  |  
|  | \[ ✓ \] ENABLE HAPTIC PULSE ON SCORING TAPS       |  |  
|  | \[ ⌚ WEARABLES & SENSORS HUB (SCREEN 16\) \]      |  | \<- Shortcut to Screen 16  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 40% ZONE \===================|  
|  \+-------------------------------------------------+  |  
|  |        📥 EXPORT LOCAL LOGS TO CSV (.CSV)       |  | \<- Native OS Share Sheet  
|  \+-------------------------------------------------+  |  
|  \+-------------------------------------------------+  |  
|  |        🔴 CLEAR CACHE & LOCAL STORAGE           |  | \<- Protected by 2-Step Modal  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 11: Player Career Hub (PlayerCareerHubView)**

Establishes the athlete's digital identity, displays verified PDGA career metrics, visualizes multi-domain putting skills via a Radar Chart, and showcases their highest-performing physical disc asset.

##### **1\. Ergonomic & Visual Architecture**

* **Verified PDGA Identity Card:** Elevated Desert Clay (\#E2DED4) container displaying player name, division (MA2), PDGA number (\#142899), and a verified green badge. Tapping opens a zero-typing numeric keypad to update PDGA linkage.  
* **Target Rating Progress Bar:** Visualizes current rating (850) against a target (900) using a Canyon Blue (\#2B5F6C) fill bar. When online, a background Supabase Edge Function (fetch-pdga-profile) automatically scrapes official tournament results and caches them locally.  
* **Multi-Domain Skill Radar (Pentagon Analysis):** Rendered SVG element measuring 5 axes: C1 Accuracy, C2 Putting ($\>33\\text{ ft}$), Endurance (session volume), Wind Mastery (conversion rate in $\>15\\text{ mph}$ wind), and Bag Balance (inventory diversity) against division averages.  
* **Most Trusted Putter Audit:** Reactive Dexie.js query scanning the discs table for the asset with the highest mathematical combination of totalChainHits and putting accuracy percentage (Axiom Cosmic Pilot • 4,820 hits • 88% accuracy).  
* **Top Action Shortcuts:** Quick links in top header routing directly to Screen 12 (\[ 🎖️ TROPHIES \]) and Screen 13 (\[ 📥 UDISC \]).

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  🏆 CAREER HUB             \[ 🎖️ TROPHIES \] \[ 📥 UDISC \]| \<- Top Action Shortcuts  
\+-------------------------------------------------------+  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  |  ( 🥏 )  RYAN MAYNARD                 \[ VERIFIED \]|  | \<- Desert Clay Container (\#E2DED4)  
|  |          PDGA \#142899 • DIVISION: MA2           |  |  
|  |                                                 |  |  
|  |  CURRENT RATING: 850        TARGET RATING: 900  |  |  
|  |  \[████████████████████████░░░░░░░░░░░\] 85%      |  | \<- Canyon Blue Progress Bar  
|  |  ⚡ 24 Career Events • 1,420 Official Points    |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  📈 CAREER TELEMETRY SUMMARY                          |  
|  \+------------------------+ \+----------------------+  |  
|  | 🎯 Lifetime Putts      | | ⛓️ C1 Conversion   |  |  
|  |    14,250 Putts Thrown | |    84.2% (Last 90d)  |  |  
|  \+------------------------+ \+----------------------+  |  
|                                                       |  
|  🕷️ MULTI-DOMAIN SKILL RADAR (PENTAGON ANALYSIS)     |  
|  \+-------------------------------------------------+  |  
|  |                 \[ C1 Accuracy \]                 |  | \<- SVG Pentagon Visualizer  
|  |                        /\\                       |  |    Tracks 5 core competencies  
|  |        \[ Wind \]       /  \\      \[ C2 Putting \]  |  |    against MA2 division averages  
|  |               \\      /\_\_\_\_\\     /               |  |  
|  |                \\    /      \\   /                |  |  
|  |                 \\  /        \\ /                 |  |  
|  |    \[ Endurance \] \\/\_\_\_\_\_\_\_\_\_\_\\/ \[ Bag Balance \] |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  👑 MOST TRUSTED PUTTER (AUTOMATIC DEXIE AUDIT)       |  
|  \+-------------------------------------------------+  |  
|  | 🥏 Axiom Cosmic Pilot (174g)                    |  | \<- Auto-selected by highest  
|  |    Odometer: 4,820 Chains Hit | Conversion: 88% |  |    total hits & accuracy\!  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  | \<- Standardized Navigation  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 12: Trophy Room & Social Gamification Hub (TrophyRoomGamificationView)**

Maximizes daily retention through RPG leveling (Level 1–50), an interactive XP Ledger, an Active Pursuits carousel, unlockable achievement badges, and offline Virtual Bag Tag challenges.

##### **1\. Ergonomic & Visual Architecture**

* **RPG Progression & XP Ledger:** Displays current level (LEVEL 34: ADVANCED FIELDWORKER) and Burnt Terracotta (\#CC4E3C) XP progress bar (8,450 / 10,000 XP). Tapping \[ 📜 LEDGER \] slides up an audit modal detailing the last 30 days of XP earning events alongside a multiplier guide (+10 XP/Make, \+50 XP/Clean Stage).  
* **Active Pursuits Carousel:** Horizontally scrollable cards highlighting the top 3 locked badges closest to completion (🌪️ GALE FORCE — 82% Complete). Features a prominent 1-tap button: \[ ▶️ LAUNCH PURSUIT DRILL \] dropping users into Screen 8 with pre-configured parameters to finish unlocking that badge.  
* **Active Virtual Bag Tag Card:** Displays current integer tag (VIRTUAL TAG \#14) and defense record. Tapping \[ ⚔️ CHALLENGE PEER \] initiates the offline QR Beam challenge loop for 1v1 pressure matches.  
* **4-Way Filtered Trophy Wall Matrix:** High-contrast Desert Clay filter bar (\[ ALL (25) \] | \[ 🔓 UNLOCKED (12) \] | \[ 🎯 IN PROGRESS (8) \] | \[ 🔒 LOCKED (5) \]). In-progress squares embed mini horizontal progress bars (\[██████░░░\] 65%). Tapping any square fires a 50ms haptic pulse and opens an inspection drawer detailing timestamps or launch recommendations.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  TROPHY ROOM & PROGRESSION          \[ 📜 LEDGER \] | \<- Tap to view full XP Audit Log  
\+-------------------------------------------------------+  
|  🌟 RPG PROGRESSION & LEVELING                        |  
|  \+-------------------------------------------------+  |  
|  |  LEVEL 34: ADVANCED FIELDWORKER    🔥 4-DAY STRK|  | \<- Desert Clay (\#E2DED4)  
|  |  \[████████████████████████████░░░░░░\] 8,450 XP  |  | \<- Burnt Terracotta XP Bar  
|  |  1,550 XP to Level 35 \[ ➔ TAP TO VIEW XP GUIDE \]|  | \<- 48px Touch Target  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🔥 ACTIVE PURSUITS (CLOSEST TO UNLOCKING)            |  
|  \+-------------------------------------------------+  |  
|  | 🌪️ GALE FORCE             \[████████████░░░\] 82% |  | \<- Horizontal Scroll Carousel  
|  | Needs 12 more Made putts in \>15mph wind         |  |  
|  | \+---------------------------------------------+ |  |  
|  | | ▶️ LAUNCH PURSUIT DRILL (+500 XP REWARD)    | |  | \<- 1-Tap Auto-Configured Drill  
|  | \+---------------------------------------------+ |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🏷️ ACTIVE VIRTUAL BAG TAG: \[ \#14 \]     \[ ⚔️ DEFEND \] | \<- Offline P2P Challenge Link  
|                                                       |  
|  🎖️ TROPHY WALL MATRIX                                |  
|  \+-------------------------------------------------+  |  
|  | \[ ALL(25) \] | \[🔓 UNLOCKED(12)\] | \[🎯 PROG(8)\](Act)| \<- 4-Way Segmented Filter  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ▼ IN-PROGRESS BADGES (TAP FOR DETAILS)               |  
|  \+-----------------+ \+-----------------+ \+---------+  |  
|  |  \[ 🤖 \]         | |  \[ 🔭 \]         | | \[ 🦾 \]  |  | \<- 3-Column Grid with  
|  |  C1 Automatic   | |  Sniper Rifle   | | Iron Arm|  |    inline progress bars\!  
|  |  \[████████░\]90% | |  \[██████░░░\]60% | | \[██░\]20%|  |  
|  \+-----------------+ \+-----------------+ \+---------+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  | \<- Standardized Active Tab  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 13: Frictionless UDisc Ingestion Center (UDiscDataIngestionView)**

Provides a seamless, zero-typing gateway to import historical UDisc rounds and parse granular hole-by-hole putting statistics without API partnerships.

##### **1\. Ergonomic & Visual Architecture**

* **1-Tap CSV Drop Zone:** High-luminance Desert Clay (\#E2DED4) dashed container. Tapping \[ ➔ OPEN NATIVE OS FILE PICKER \] launches the system file selector, or receives .csv payloads directly from UDisc via native iOS/Android share sheets.  
* **Step-by-Step Guidance:** Clear 3-step visual instruction block in Oswald typography explaining how to export from UDisc without typing.  
* **Granular Telemetry Parser & Audit Log:** Async Web Worker reads CSV rows. Extracts general round scores while scanning for Putts C1 and Putts C2 columns to increment local Dexie.js odometers. Displays import status (SUCCESS • 142 Rounds • 2,480 Putts Added).  
* **Bulk XP Reward:** Awards a retroactive bonus of \+10 XP per parsed career putt, instantly leveling up the user's RPG profile.  
* **Safety Guardrail (\[ 🗑️ CLEAR UDISC HISTORY \]):** Deep Rust (\#8C2D19) button allowing users to wipe imported data without affecting native fieldwork logs.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  UDISC HISTORICAL INGESTION                 \[ ❓ \]| \<- Top Header  
\+-------------------------------------------------------+  
|                                                       |  
|  📥 1-TAP CSV DROP ZONE                               |  
|  \+-------------------------------------------------+  |  
|  |                                                 |  | \<- High-Luminance Desert Clay  
|  |        📂 TAP TO SELECT UDISC CSV EXPORT        |  |    Dashed Border Container  
|  |           or share directly from UDisc app      |  |  
|  |                                                 |  |  
|  |        \[ ➔ OPEN NATIVE OS FILE PICKER \]         |  | \<- 56px Action Target  
|  |                                                 |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ⚡ HOW FRICTIONLESS IMPORT WORKS                      |  
|  \+-------------------------------------------------+  |  
|  | 1\. Open UDisc ➔ Go to 'More' ➔ 'Export Data'   |  | \<- Step-by-step guidance  
|  | 2\. Select 'Share CSV' and tap 'Disc Golf App'   |  |  
|  | 3\. Our local AI parser extracts rounds & putts  |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  📊 INGESTION ENGINE AUDIT LOG (LOCAL DEXIE.JS)       |  
|  \+-------------------------------------------------+  |  
|  | Last Import: July 1, 2026 • Status: SUCCESS     |  |  
|  | • 142 Total Rounds Parsed                       |  |  
|  | • 2,480 Granular Putting Telemetry Points Added |  |  
|  | • \+1,500 Bulk Import XP Awarded to Profile\!     |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 40% ZONE \===================|  
|  \+-------------------------------------------------+  |  
|  |      🗑️ CLEAR IMPORTED UDISC HISTORY            |  | \<- Deep Rust (\#8C2D19) Guardrail  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  |  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

### **MODULE 5: SOCIAL COMPETITION & LEAGUES**

#### **Screen 14: Course Practice Hubs & Leaderboards (CoursePracticeHubView)**

The local community layer transforming isolated fieldwork into geo-fenced course competition at local park practice greens.

##### **1\. Ergonomic & Visual Architecture**

* **Geo-Fenced Check-In Pill:** When GPS detects proximity within $500\\text{ m}$ of a known course basket (e.g., *East Roswell Park*), the header renders a Canyon Blue (\#2B5F6C) check-in badge: 📍 EAST ROSWELL PARK GREEN DETECTED \[ JOIN HUB \].  
* **Asynchronous "King of the Green" Leaderboard:** 3-way segmented filter (\[ C1 ACCURACY \] | \[ C2 SNIPER \] | \[ STREAK \]) ranking local players monthly. Works offline; queues scores in Dexie.js and updates leaderboard standings asynchronously upon cellular restoration.  
* **Player Action Cards:** Elevated Desert Clay containers displaying player stats, preferred putters, and dual action targets: \[ 👊 FIST BUMP \] and \[ ⚔️ CHALLENGE TAG \].  
* **Zero-Typing "Kudos & Trash Talk" Feed:** High-luminance social stream where friends' badge unlocks appear. Athletes send 1-tap sensory reactions (👊, 🔥, ❄️) awarding the recipient \+5 XP.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  COURSE HUB: EAST ROSWELL PARK              \[ 📍 \]| \<- Geo-verified check-in  
\+-------------------------------------------------------+  
|  👑 KING OF THE GREEN (JULY 2026 LEADERBOARD)         |  
|  \+-------------------------------------------------+  |  
|  | \[ C1 ACCURACY \](Actv) | \[ C2 SNIPER \] | \[STREAK\]|  | \<- 3-Way Segmented Filter  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ▼ 1\. RYAN MAYNARD (YOU)  \[ 88.5% C1 \]  🔥 14 STRK   | \<- Desert Clay (\#E2DED4)  
|  \+-------------------------------------------------+  |  
|  |  • 350 Putts Logged at East Roswell this month  |  |  
|  |  • Preferred Putter: Axiom Cosmic Pilot (174g)  |  |  
|  |  \[ 👊 24 FIST BUMPS \]       \[ ⚔️ CHALLENGE TAG \]|  | \<- 48px Action Targets  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ► 2\. ALEX CHEN           \[ 86.0% C1 \]  🔥 8 STRK    | \<- Collapsed Leaderboard Cards  
|  ► 3\. SARAH JENKINS       \[ 84.2% C1 \]  🔥 19 STRK   |  
|                                                       |  
|  💬 LOCAL KUDOS FEED (ZERO-TYPING REACTIONS)          |  
|  \+-------------------------------------------------+  |  
|  | 🏆 Alex C. just unlocked "Gale Force" in 18mph wind\!|  
|  |    \[ 👊 FIST BUMP (+5 XP) \]   \[ 🔥 ON FIRE \]    |  | \<- 1-Tap Sensory Reactions  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  | \<- Standardized Navigation  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 15: Putting League Bracket Manager & History (PuttingLeagueBracketView)**

The offline-first "Tournament Director" engine for running weekly off-season putting leagues at breweries, parks, or backyards from a single device.

##### **1\. Ergonomic & Visual Architecture**

* **3-Way League Mode Header:** Segmented toggle switching between \[ 📜 BRACKET \], \[ ⚔️ ACTIVE MATCH \], and \[ 📈 HISTORY \].  
* **1-Tap Player Registration & Seeding:** Add 8 to 16 players via local Dexie.js friends lists or by scanning peer QR Beams. Auto-generates Double Elimination or Round Robin pairings.  
* **Zero-Typing Match Advancing:** Active match cards feature giant numeric touch blocks (\[ 8 \] vs \[ 6 \]) for 10-putt station rotations. Tapping \[ ➔ CONFIRM WINNER \] advances the visual ASCII bracket in Dexie.js instantly without cell service.  
* **Competition History & Win/Loss Ledger:** In History mode, displays all-time head-to-head records against specific opponents (WIN: 14 | LOSS: 6 | 70%), recent match logs, and Virtual Bag Tag movement history.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  PUTTING LEAGUE: GATE CITY BREWERY        \[ ⚙️ \]  | \<- Top Header  
\+-------------------------------------------------------+  
|  🏆 FORMAT: 8-PLAYER DOUBLE ELIMINATION (ROUND 2\)     |  
|  \+-------------------------------------------------+  |  
|  | \[ 📜 BRACKET \](Actv) | \[ ⚔️ ACTIVE MATCH \] | \[LOG\]|  | \<- 3-Way Segmented Filter  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ⚔️ CURRENT MATCHUP: STATION 1 (20FT & 30FT)          |  
|  \+-------------------------------------------------+  |  
|  |  \[ SEED \#1 \] RYAN MAYNARD       SCORE: \[  8  \]  |  | \<- Giant Numeric Touch Blocks  
|  |               VS                                |  |    (Zero Keyboard Entry\!)  
|  |  \[ SEED \#4 \] MARCUS VANCE       SCORE: \[  6  \]  |  |  
|  |                                                 |  |  
|  |  \[ ➔ CONFIRM WINNER: RYAN MAYNARD (+150 XP) \]   |  | \<- Burnt Terracotta (\#CC4E3C)  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  📊 WINNERS BRACKET PROGRESSION                       |  
|  \+-------------------------------------------------+  |  
|  |  R. MAYNARD (8) ──┐                             |  | \<- Visual ASCII / Canvas Bracket  
|  |                   ├── R. MAYNARD ──┐            |  |    Auto-advances locally in  
|  |  S. JENKINS (5) ──┘                │            |  |    Dexie.js\!  
|  |                                    ├── \[ FINAL \]|  |  
|  |  A. CHEN (7)    ──┐                │            |  |  
|  |                   ├── A. CHEN    ──┘            |  |  
|  |  D. MILLER (6)  ──┘                             |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  |  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 16: Smartwatch Companion & Wearables Hub (WearableSensorsHubView)**

The Phase 2 wearable integration hub removing the phone from the athlete's hand entirely during active fieldwork sessions.

##### **1\. Ergonomic & Visual Architecture**

* **Watch Face Mode Switcher:** Configures native watchOS/Garmin companion displays directly from the phone:  
  * **Minimalist Wrist-Tap Mode:** Splits watch face horizontally into two giant tactile zones (Top Half \= Made Putt with green haptic pulse; Bottom Half \= Missed Putt with red double-buzz).  
  * **Biometric Pacer Mode:** Displays real-time heart rate (BPM). If BPM spikes above $120$ before a Circle 1 edge putt, the watch emits a rhythmic breathing haptic pulse to settle the nervous system.  
* **BLE Basket Sensor Calibration (Future IoT):** Manages Bluetooth Low Energy connections to smart putting baskets, calibrating chain vibration profiles to mathematically distinguish between center-pole smashes and weak edge spit-outs.  
* **Sync Status Card:** Displays real-time connection latency and battery health for paired wearable devices.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  WEARABLES & SENSORS HUB                    \[ ❓ \]| \<- Top Header  
\+-------------------------------------------------------+  
|  ⌚ PAIRED DEVICE: APPLE WATCH ULTRA 2  \[ 🟢 CONNECTED\]|  
|  \+-------------------------------------------------+  |  
|  | Battery: 84% • Sync Latency: 12ms (BLE 5.3)     |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🗖 WATCH FACE SCORING MODE SELECTOR                  |  
|  \+-------------------------------------------------+  |  
|  | \[ ⌚ WRIST-TAP \](Actv) | \[ ❤️ BIOMETRIC PACER \]  |  | \<- Segmented Mode Picker  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ▼ WRIST-TAP MODE PREVIEW (WATCH DISPLAY)             |  
|  \+-------------------------------------------------+  |  
|  |  \+-------------------------------------------+  |  |  
|  |  |       TAP TOP HALF: \[ MADE PUTT \]         |  |  | \<- Top 50% Watch Touch Zone  
|  |  |       (Fires Single Green Haptic Pulse)   |  |  |  
|  |  \+-------------------------------------------+  |  |  
|  |  |       TAP BOTTOM HALF: \[ MISSED PUTT \]    |  |  | \<- Bottom 50% Watch Touch Zone  
|  |  |       (Fires Double Red Error Buzz)       |  |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  📡 SMART BASKET SENSOR CALIBRATION (IOT PHASE 2\)     |  
|  \+-------------------------------------------------+  |  
|  | Status: \[ ⚪ NO SMART BASKET DETECTED \]          |  |  
|  | \[ 🔍 SCAN FOR BLE 5.0 CHAIN TARGETS \]           |  | \<- 48px Action Target  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  |  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 17: Pro-Shop & Gear Discovery Engine (ProShopDiscoveryView)**

The equipment fulfillment layer converting analytical "Ghost Slots" and odometer wear alerts into actionable shopping recommendations with exclusive discounts.

##### **1\. Ergonomic & Visual Architecture**

* **Stability Gap Matchmaker:** Bridges Screen 5 directly to retail. If a user lacks an overstable utility mid, Screen 17 surfaces exact in-stock molds from GYRO brands (MVP Deflector, Axiom Tempo) with matching 4-number flight charts.  
* **Odometer Replacement Advisor:** When a putter crosses **5,000 chain hits** in Dexie.js and wear drops below 4.0, proactively recommends ordering an exact backup run in identical weight and plastic before tournament day.  
* **Partner Locator & Stock Filter:** Segmented toggle for \[ 🌐 ONLINE PARTNERS \] (OTB Discs, Marshall Street) vs \[ 📍 LOCAL PRO SHOPS \] within $25\\text{ miles}$.  
* **1-Tap Promo Code Clipboard:** Displays exclusive affiliate discount codes (DISCGOLFAPP10). Tapping copies the code to the OS clipboard and launches direct product checkout URLs.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  GEAR DISCOVERY & PRO-SHOP                  \[ 🛒 \]| \<- Top Header  
\+-------------------------------------------------------+  
|  💡 STABILITY GAP MATCHMAKER                          |  
|  Fulfilling Bag Ghost Slot: Overstable Approach Mid   |  
|  \+-------------------------------------------------+  |  
|  | \[ 🌐 ONLINE PARTNERS \](Act) | \[ 📍 LOCAL SHOPS \]|  | \<- 2-Way Segmented Filter  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  ▼ 1\. MVP DEFLECTOR \[ 5 / 3 / 0 / 4 \]   \[ 🟢 IN STOCK \]| \<- Desert Clay Container (\#E2DED4)  
|  \+-------------------------------------------------+  |  
|  |  • Plastic: Proton / Neutron • Weights: 170-177g|  |  
|  |  • Retailer: OTB Discs (Free Shipping Available)|  |  
|  |  \+-------------------------------------------+  |  |  
|  |  | 🎁 PROMO: DISCGOLFAPP10 \[ 📋 COPY & SHOP \]|  |  | \<- 1-Tap Copy & Open URL  
|  |  \+-------------------------------------------+  |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🛠️ ODOMETER REPLACEMENT ADVISOR                      |  
|  \+-------------------------------------------------+  |  
|  | ⚠️ Your Axiom Pilot has crossed 5,000 chain hits|  |  
|  |    and is highly beaten-in (Wear Score: 3.5).   |  |  
|  |    \[ ➔ FIND EXACT 174G ELECTRON BACKUP RUN \]    |  | \<- Direct Match Re-order  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 4-TAB BAR \==================|  
|  \+-------------------------------------------------+  |  
|  |  \[ 🏠 PLAY \]   \[ 💼 BAGS \]   \[ 📊 STATS \]  \[ 👤 PRO \]|  |  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

### **MODULE 6: SAFETY, INTEGRITY & UTILITIES**

#### **Screen 18: Offline Sync & Conflict Resolution Center (SyncConflictView)**

The data integrity guardian triggering only when TanStack Query detects a 409 collision between local Dexie.js state and Supabase cloud state during multi-device synchronization.

##### **1\. Ergonomic & Visual Architecture**

* **Non-Blocking Interruption Banner:** Replaces silent data clobbering with a high-contrast top notification: ⚠️ SYNC CONFLICT DETECTED. TAP TO RESOLVE.  
* **Atomic Side-by-Side Comparison:** Renders divergent record fields (e.g., Wear Score or Odometer) across two distinct columns (\[ 📱 LOCAL VERSION \] vs \[ ☁️ CLOUD VERSION \]) with exact modification timestamps.  
* **1-Tap Domain Resolution:** Highlights the recommended button based on our Hybrid Domain-Specific Merge rules (MAX odometer hits / MIN wear score), alongside an escape hatch to export both records to CSV.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  SYNC CONFLICT RESOLUTION             \[ ✕ \]       | \<- Top Header  
\+-------------------------------------------------------+  
|  ⚠️ DATA COLLISION DETECTED                           |  
|  The record for "Axiom Cosmic Pilot" has changed     |  
|  in two locations. Please select the correct version. |  
\+-------------------------------------------------------+  
|  \[ 📱 LOCAL VERSION \]       |  \[ ☁️ CLOUD VERSION \]   |  
|  (Last Modified: 10:00AM)   |  (Last Modified: 10:15AM)|  
|  \+-----------------------+  \+----------------------+  |  
|  | Wear Score: 7.0       |  | Wear Score: 6.5      |  |  
|  | Odometer: 4,820 hits  |  | Odometer: 4,850 hits |  |  
|  \+-----------------------+  \+----------------------+  |  
|                                                       |  
|  \[ ➔ KEEP LOCAL \]           \[ ➔ OVERWRITE W/ CLOUD \]  | \<- 48px Touch Targets  
|                                                       |  
|  \[ 📥 EXPORT BOTH TO CSV & RESOLVE LATER \]            | \<- Safety escape hatch  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 19: Privacy & Data Sovereignty Hub (LegalDataHubView)**

The legal compliance and data ownership center providing zero-scrolling access to GDPR/CCPA regulations and complete database extraction.

##### **1\. Ergonomic & Visual Architecture**

* **Compliance Document Viewer:** Clean Desert Clay accordion containers for official Privacy Policies, Terms of Service, and third-party software licenses.  
* **Universal Data Export:** Full-width Burnt Terracotta button compressing all local Dexie.js and Supabase records into a standardized JSON/CSV archive delivered via native share sheets.  
* **Right to be Forgotten (\[ 🛡️ REQUEST TOTAL DATA PURGE \]):** Rendered in Deep Rust (\#8C2D19). Triggers an irreversible Supabase API call wiping all auth.users records and destroying local IndexedDB stores following 2-step confirmation.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  PRIVACY & DATA SOVEREIGNTY                 \[ ⚖️ \]| \<- Top Header  
\+-------------------------------------------------------+  
|  🛡️ YOUR DATA, 100% YOUR OWN                          |  
|  We believe athletes own their telemetry. We never    |  
|  sell putting logs or location data to advertisers.   |  
\+-------------------------------------------------------+  
|  📜 LEGAL COMPLIANCE ACCORDIONS                       |  
|  \+-------------------------------------------------+  |  
|  | ► PRIVACY POLICY (GDPR / CCPA COMPLIANT)        |  | \<- Tap to expand plaintext  
|  \+-------------------------------------------------+  |  
|  | ► TERMS OF SERVICE & LIABILITY WAIVER           |  |  
|  \+-------------------------------------------------+  |  
|  | ► OPEN SOURCE LIBRARIES & LICENSES              |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  📥 COMPLETE DATA PORTABILITY                         |  
|  \+-------------------------------------------------+  |  
|  | \[ 📦 DOWNLOAD COMPLETE ARCHIVE (JSON \+ CSV) \]   |  | \<- 56px Action Target  
|  \+-------------------------------------------------+  |  
|                                                       |  
|=================== BOTTOM 40% ZONE \===================|  
|  \+-------------------------------------------------+  |  
|  |      🛡️ REQUEST TOTAL DATA PURGE (DELETE)       |  | \<- Deep Rust (\#8C2D19) Guardrail  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 20: Firmware & Sensor Diagnostics (SensorDiagnosticsView)**

The advanced hardware engineering panel managing IoT basket targets, BLE signal calibration, and physical sensor battery health.

##### **1\. Ergonomic & Visual Architecture**

* **Real-Time Telemetry Stream:** Displays live RSSI signal strength (-42 dBm), packet loss rates, and firmware versions for connected BLE 5.0 smart targets.  
* **Impact Signal Calibration Graph:** Live canvas plotting chain vibration waveforms in real time, allowing engineers or users to adjust threshold sensitivity sliders for center-pole vs. edge spit-out recognition.  
* **Firmware Over-The-Air (OTA) Updater:** 1-tap action block querying Vercel edge buckets for sensor firmware patches and broadcasting updates over Bluetooth.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  ⬅️  FIRMWARE & SENSOR DIAGNOSTICS              \[ 🔧 \]| \<- Top Header  
\+-------------------------------------------------------+  
|  📡 TARGET STATUS: \[ 🟢 BLE BASKET SENSOR V2 \]        |  
|  \+-------------------------------------------------+  |  
|  | MAC: 00:1A:7D:DA:71:13 • RSSI: \-42 dBm (Excellent)|  |  
|  | Battery: 92% (LiFePO4 Solar) • Firmware: v2.1.0 |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  🌊 IMPACT SIGNAL SENSITIVITY CALIBRATION             |  
|  \+-------------------------------------------------+  |  
|  |  Amplitude (g)   \[ LIVE VIBRATION WAVEFORM \]    |  |  
|  |    10.0 \+------------------------------------+  |  | \<- Canvas rendering raw  
|  |     5.0 |         /\\                         |  |  |    accelerometer spikes  
|  |     0.0 \+--------/--\\/\\----------------------+  |  |  
|  |          Threshold: \[ 4.2g \] (Center Smash)     |  | \<- Sensitivity Slider  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  📥 OVER-THE-AIR (OTA) FIRMWARE MANAGEMENT            |  
|  \+-------------------------------------------------+  |  
|  | Current: v2.1.0 • Latest Available: v2.1.2      |  |  
|  | \[ ⚡ FLASH FIRMWARE UPDATE OVER BLE (120 KB) \]  |  | \<- 48px Action Target  
|  \+-------------------------------------------------+  |  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

#### **Screen 21: Emergency Panic Recovery Overlay (AppEmergencyOverlay)**

The global safety net bypassing standard router navigation during rare database corruption events or application boot failures.

##### **1\. Ergonomic & Visual Architecture**

* **Deep-Linkable Panic Room:** Triggered automatically by error boundaries if Dexie.js fails to mount (Dexie.NotFoundError), or manually via triple-tapping the app version string in Settings.  
* **Tiered Recovery Hierarchy:** Prioritizes data rescue at the top of the viewport (\[ 1\. 📥 EXPORT LOGS TO CSV \]), followed by non-destructive index repair (\[ 2\. 🔄 REBUILD LOCAL DB CACHE \]), and direct support bundle generation (\[ 3\. 📞 CONTACT SUPPORT \]).  
* **Nuclear Wipe Guardrail:** Visually isolated at the absolute bottom in Deep Rust (\#8C2D19), requiring sequential two-step confirmation block taps before resetting local storage to factory defaults.

##### **2\. ASCII Wireframe Blueprint (iPhone 17 Pro Max — 9:20 Ratio)**

Plaintext  
\+-------------------------------------------------------+  
|  \[STATUS BAR: 9:20 | Dynamic Island | 5G 🔋\]          |  
\+-------------------------------------------------------+  
|  🚨 SYSTEM INTEGRITY & RECOVERY                       | \<- Deep Rust Header (\#8C2D19)  
\+-------------------------------------------------------+  
|                                                       |  
|  STATUS: \[ ❌ DEXIE.JS CACHE CORRUPTED \]              |  
|  System cannot mount the local database. Your         |  
|  practice logs are at risk.                           |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | 1\. 📥 EXPORT LOGS TO CSV                        |  | \<- High priority safety  
|  |    Safely extract your raw data first.          |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | 2\. 🔄 REBUILD LOCAL DB CACHE                    |  | \<- Attempt to fix index  
|  |    Attempts to repair the local storage index.  |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | 3\. 📞 CONTACT TECHNICAL SUPPORT                 |  | \<- Direct email link  
|  |    Include system diagnostic bundle (v1.0.0).   |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \[ 🔴 NUCLEAR WIPE: RESET APP TO FACTORY \]          | \<- Hidden behind 2-step  
\+-------------------------------------------------------+  
|  \[HOME INDICATOR BAR\]                                 |  
\+-------------------------------------------------------+

## **SECTION 4: LOGIC-GOVERNANCE SPECIFICATIONS**

### **1\. COMPETITION\_ENGINE.md — P2P Head-to-Head & League Match Logic**

Markdown  
\# COMPETITION\_ENGINE.md — P2P Match & League Governance  
\*\*Protocol:\*\* Asynchronous P2P QR Beam Handshake & Local Dexie.js Resolution  

\#\#\#\# 1\. MATCH STATE MACHINE  
All 1v1 challenges and league matches must strictly adhere to this linear lifecycle:  
\`REQUESTED\` (Challenger generates QR Beam) $\\rightarrow$ \`HANDSHAKE\_COMPLETE\` (Opponent scans QR; parameters locked in Dexie.js) $\\rightarrow$ \`IN\_PROGRESS\` (Both athletes execute scoring canvas) $\\rightarrow$ \`PENDING\_RESOLUTION\` (Waiting for offline P2P sync or cloud broadcast) $\\rightarrow$ \`COMPLETED\` (Winner declared; Bag Tags swapped).

\#\#\#\# 2\. DETERMINISTIC TIE-BREAK PROTOCOL  
To eliminate field disputes without a referee, tie-breaks execute automatically:  
\* \*\*Primary Tie-Break (Sudden Death):\*\* If scores tie at routine completion, the app mounts an immediate 1-putt Sudden Death stage at Circle 1 Edge ($33\\text{ ft}$). First athlete to convert while opponent misses wins.  
\* \*\*Secondary Tie-Break (Stat Fallback):\*\* If physical Sudden Death is impossible due to darkness or time limits, the winner is determined by \*\*Streak Peak\*\* (highest consecutive made putts during the match).

\#\#\#\# 3\. VIRTUAL BAG TAG SWAP CONTRACT  
\`\`\`typescript  
if (match.status \=== 'COMPLETED' && match.challengerScore \!== match.opponentScore) {  
  const winner \= match.challengerScore \> match.opponentScore ? match.challengerId : match.opponentId;  
  const loser \= winner \=== match.challengerId ? match.opponentId : match.challengerId;  
    
  // Winner always claims the lower integer tag number  
  if (winner.currentTagNumber \> loser.currentTagNumber) {  
    const tempTag \= winner.currentTagNumber;  
    winner.currentTagNumber \= loser.currentTagNumber;  
    loser.currentTagNumber \= tempTag;  
    await db.profiles.bulkPut(\[winner, loser\]);  
  }  
}

#### **4\. TIME-BOXING & EXPIRATION GUARDRAILS**

All matches carry a max\_duration\_minutes: 30 property. If a match remains IN\_PROGRESS beyond 30 minutes, an automated alert prompts: *"Match time expired. Finalize current score to determine winner?"* preventing orphan matches from clogging local storage.

\---

\#\#\# 2\. \`INGESTION\_PARSER\_SPEC.md\` — UDisc Historical CSV Ingestion Engine  
\`\`\`markdown  
\# INGESTION\_PARSER\_SPEC.md — UDisc CSV Ingestion Governance  
\*\*Target:\*\* Clean extraction of UDisc \`.csv\` exports via native iOS/Android share sheets into Dexie.js.  

\#\#\#\# 1\. COLUMN MAPPING DICTIONARY  
The async Web Worker must map standard UDisc CSV headers to internal database fields:  
\* \`CourseName\` $\\rightarrow$ \`UDiscRoundLog.courseName\`  
\* \`LayoutName\` $\\rightarrow$ \`UDiscRoundLog.layoutName\`  
\* \`Date\` \+ \`Time\` $\\rightarrow$ \`UDiscRoundLog.roundDate\` (ISO 8601 standardized)  
\* \`Total\` / \`+-\` $\\rightarrow$ \`UDiscRoundLog.totalScore\` / \`plusMinus\`  
\* \`Putts C1\` / \`Putts C2\` $\\rightarrow$ Extracted into \`putting\_session\_logs\` and added to \`PlayerProfile.lifetimePutts\`.

\#\#\#\# 2\. DEDUPLICATION & VALIDATION RULES  
Before committing any row to Dexie.js, execute a compound index lookup:  
\`db.udiscRounds.where({ roundDate: row.Date, courseName: row.Course }).first()\`. If a record exists, skip insertion to prevent double-counting career stats. Ignore rows where \`Total\` is null or zero.

\#\#\#\# 3\. BULK XP REWARD FORMULA  
To incentivize importing historical data without breaking RPG balance, award a one-time retroactive bonus:  
\`TotalImportXP \= Math.min(TotalParsedPutts \* 10, 10000)\`. Max cap prevents instant Level 50 jumps from single imports.

### **3\. GAMIFICATION\_AND\_XP\_LEDGER.md — RPG Leveling & Achievement Engine**

Markdown  
\# GAMIFICATION\_AND\_XP\_LEDGER.md — Progression Governance  
\*\*Engine:\*\* Event-driven local evaluation via \`BadgeEvaluatorService.ts\`.  

\#\#\#\# 1\. XP PAYOUT CONSTANTS  
\* \`BASE\_MAKE\_XP \= 10\` (Awarded per successful putt logged on Screen 8\)  
\* \`CLEAN\_STAGE\_BONUS\_XP \= 50\` (Awarded for 100% accuracy on any stage $\\ge 10$ putts)  
\* \`DAILY\_STREAK\_XP \= 200\` (Awarded upon completing the first routine of a calendar day)  
\* \`P2P\_MATCH\_WIN\_XP \= 350\` (Awarded for defeating a peer in an offline Bag Tag match)

\#\#\#\# 2\. RPG LEVELING CURVE FORMULA  
Experience points scale exponentially from Level 1 (Rec) to Level 50 (Tour Pro):  
\`\`\`typescript  
export function calculateXpForLevel(level: number): number {  
  return Math.floor(1000 \* Math.pow(1.15, level \- 1));  
}

#### **3\. EVENT EVALUATION MATRIX**

* **Post-Scoring (ScoringCanvasView commit):** Evaluates Volume badges (first-step, fieldworker, 10k-club), Precision badges (c1-automatic, sniper-c2), and Weather feats (gale-force, rain-or-shine).  
* **Post-Inventory (PutterLineupView mutation):** Evaluates Odometer badges (putter-loyalty, beaten-in) and Bag limits (bag-maxed, plastic-scientist).  
* **Post-Ingestion (UDiscDataIngestionView success):** Evaluates data-historian and recalculates lifetime odometer ceilings.

\---

\#\# SECTION 5: DATABASE SCHEMA & MERGE TRIGGERS (\`DATABASE\_SCHEMA.md\`)

\`\`\`sql  
\-- DATABASE\_SCHEMA.md — Supabase PostgreSQL Cloud Contracts & RLS  
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\-- 1\. BAGS TABLE (35-disc limit enforced)  
CREATE TABLE bags (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,  
  name TEXT NOT NULL,  
  capacity\_limit INTEGER DEFAULT 35 CHECK (capacity\_limit \<= 35),  
  is\_practice\_stack BOOLEAN DEFAULT false,  
  disc\_count INTEGER DEFAULT 0,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- 2\. DISCS TABLE (Inventory & odometers)  
CREATE TABLE discs (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,  
  bag\_id UUID REFERENCES bags(id) ON DELETE SET NULL,  
  brand TEXT NOT NULL,  
  mold TEXT NOT NULL,  
  plastic TEXT NOT NULL,  
  weight\_grams INTEGER NOT NULL,  
  speed NUMERIC(3,1) NOT NULL,  
  glide NUMERIC(3,1) NOT NULL,  
  turn NUMERIC(3,1) NOT NULL,  
  fade NUMERIC(3,1) NOT NULL,  
  wear\_score NUMERIC(3,1) DEFAULT 10.0 CHECK (wear\_score \>= 1.0 AND wear\_score \<= 10.0),  
  total\_chain\_hits INTEGER DEFAULT 0,  
  is\_ghost\_slot BOOLEAN DEFAULT false,  
  role TEXT DEFAULT 'STANDARD' CHECK (role IN ('PRIMARY\_PUTTER', 'BACKUP\_PUTTER', 'SITUATIONAL\_WEATHER', 'STANDARD')),  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- 3\. PUTTING ROUTINES TABLE (100-putt fatigue ceiling)  
CREATE TABLE putting\_routines (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  
  name TEXT NOT NULL,  
  is\_standard\_preset BOOLEAN DEFAULT false,  
  category TEXT DEFAULT 'CUSTOM' CHECK (category IN ('CALIBRATION', 'ENDURANCE', 'PRESSURE', 'WARMUP', 'CUSTOM')),  
  stages JSONB NOT NULL,  
  total\_putts INTEGER NOT NULL CHECK (total\_putts \<= 100),  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- 4\. PUTTING SESSION LOGS TABLE (Append-Only telemetry)  
CREATE TABLE putting\_session\_logs (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,  
  routine\_id UUID REFERENCES putting\_routines(id) ON DELETE SET NULL,  
  active\_putter\_id UUID REFERENCES discs(id) ON DELETE SET NULL,  
  timestamp TIMESTAMPTZ DEFAULT NOW(),  
  weather\_wind\_mph INTEGER DEFAULT 0,  
  weather\_condition TEXT DEFAULT 'CLEAR' CHECK (weather\_condition IN ('CLEAR', 'RAIN', 'HEADWIND', 'TAILWIND')),  
  stage\_results JSONB NOT NULL,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- 5\. PLAYER PROFILES TABLE (Career & Bag Tags)  
CREATE TABLE player\_profiles (  
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  
  display\_name TEXT NOT NULL,  
  pdga\_number INTEGER UNIQUE,  
  division TEXT DEFAULT 'MA2',  
  current\_rating INTEGER DEFAULT 0,  
  target\_rating INTEGER DEFAULT 900,  
  rpg\_level INTEGER DEFAULT 1,  
  current\_xp INTEGER DEFAULT 0,  
  virtual\_bag\_tag INTEGER UNIQUE,  
  updated\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- 6\. VIRTUAL BAG TAG MATCHES TABLE  
CREATE TABLE virtual\_tag\_matches (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  challenger\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  
  opponent\_name TEXT NOT NULL,  
  routine\_name TEXT NOT NULL,  
  challenger\_score INTEGER NOT NULL,  
  opponent\_score INTEGER NOT NULL,  
  winner\_id UUID,  
  tag\_contested INTEGER NOT NULL,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- 7\. COURSE PRACTICE HUBS TABLE  
CREATE TABLE course\_practice\_hubs (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  course\_name TEXT NOT NULL,  
  basket\_location\_name TEXT NOT NULL,  
  latitude NUMERIC(9,6) NOT NULL,  
  longitude NUMERIC(9,6) NOT NULL,  
  active\_players\_count INTEGER DEFAULT 0  
);

\-- 8\. PUTTING LEAGUE BRACKETS TABLE  
CREATE TABLE putting\_league\_brackets (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  league\_name TEXT NOT NULL,  
  format TEXT DEFAULT 'DOUBLE\_ELIM' CHECK (format IN ('DOUBLE\_ELIM', 'ROUND\_ROBIN')),  
  player\_seeds JSONB NOT NULL,  
  matches JSONB NOT NULL,  
  is\_completed BOOLEAN DEFAULT false,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- ROW LEVEL SECURITY (RLS) POLICIES  
ALTER TABLE bags ENABLE ROW LEVEL SECURITY;  
ALTER TABLE discs ENABLE ROW LEVEL SECURITY;  
ALTER TABLE putting\_routines ENABLE ROW LEVEL SECURITY;  
ALTER TABLE putting\_session\_logs ENABLE ROW LEVEL SECURITY;  
ALTER TABLE player\_profiles ENABLE ROW LEVEL SECURITY;  
ALTER TABLE virtual\_tag\_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bags" ON bags FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Users manage own discs" ON discs FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Users manage own routines" ON putting\_routines FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Users manage own logs" ON putting\_session\_logs FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Public read profiles for leaderboards" ON player\_profiles FOR SELECT USING (true);  
CREATE POLICY "Users update own profile" ON player\_profiles FOR UPDATE USING (auth.uid() \= id);  
CREATE POLICY "Users log own tag matches" ON virtual\_tag\_matches FOR INSERT WITH CHECK (auth.uid() \= challenger\_id);

\-- HYBRID DOMAIN-SPECIFIC MERGE TRIGGERS  
CREATE OR REPLACE FUNCTION resolve\_disc\_sync\_conflict()  
RETURNS TRIGGER AS $$  
BEGIN  
  \-- You can never un-throw a putt: highest chain hit count always wins  
  NEW.total\_chain\_hits := GREATEST(OLD.total\_chain\_hits, NEW.total\_chain\_hits);  
  \-- Discs only degrade over time: lowest wear score takes precedence  
  NEW.wear\_score := LEAST(OLD.wear\_score, NEW.wear\_score);  
  NEW.updated\_at := NOW();  
  RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger\_disc\_conflict\_resolution  
BEFORE UPDATE ON discs  
FOR EACH ROW EXECUTE FUNCTION resolve\_disc\_sync\_conflict();

## **SECTION 6: ATOMIC SPRINT EXECUTION ROADMAP (TASKS.md)**

Markdown  
\# TASKS.md — 7-Layer Atomic Execution Backlog  
\*\*Instructions for Claude Code:\*\* Execute tasks strictly in numerical order. Do not skip layers. Mark tasks complete by changing \`\[ \]\` to \`\[x\]\` upon passing unit/e2e verification.

\#\#\# LAYER 1: FOUNDATION & DATA ARCHITECTURE  
\- \[ \] 1.1 Initialize Expo Managed workflow project with TypeScript strict mode and Expo Router file-based routing.  
\- \[ \] 1.2 Install and configure \`pnpm\`, NativeWind v4+, and inject our \*Sun-Drenched Topo (Oswald Edition)\* hex tokens into \`tailwind.config.js\`.  
\- \[ \] 1.3 Instantiate Dexie.js local database schema (\`db.ts\`) mapping all 8 core tables (\`discs\`, \`bags\`, \`puttingRoutines\`, \`sessionLogs\`, \`profiles\`, \`tagMatches\`, \`courseHubs\`, \`leagueBrackets\`).  
\- \[ \] 1.4 Execute Supabase SQL migrations from \`DATABASE\_SCHEMA.md\` to establish cloud tables, RLS policies, and Hybrid Domain-Specific Merge triggers.  
\- \[ \] 1.5 Configure TanStack Query offline-first replication hooks binding Dexie.js live observables to asynchronous Supabase background sync.

\#\#\# LAYER 2: UI ATOMS & ZERO-TYPING PRIMITIVES  
\- \[ \] 2.1 Build \`OswaldText\` and \`InterText\` typography components enforcing Deep Slate (\`\#1A1D1A\`) and Muted Slate (\`\#4A524A\`) high-luminance contrast.  
\- \[ \] 2.2 Build \`TouchTarget48\` reusable button wrapper enforcing minimum 48px height, solid 2px borders, and Burnt Terracotta (\`\#CC4E3C\`) active states.  
\- \[ \] 2.3 Build \`SegmentedGridChip\` horizontal selector for zero-typing distance and putt increment selection.  
\- \[ \] 2.4 Build \`OtpInputGrid\` rendering four 56px touch blocks for passwordless SMS code entry (Screen 2).  
\- \[ \] 2.5 Build \`HapticTestPad\` component executing \`navigator.vibrate(\[50, 50, 50\])\` for onboarding sensory calibration (Screen 3).

\#\#\# LAYER 3: INVENTORY CURATION & ROUTINE ENGINE  
\- \[ \] 3.1 Scaffold \`BagManagerView\` (Screen 5\) with a 3-way segmented header (\`MY BAGS\` | \`PUTTERS\` | \`UNIVERSE\`).  
\- \[ \] 3.2 Implement the \*\*35-Disc Capacity Interlock\*\*: dynamically disable \`\[ \+ Add \]\` buttons and trigger Deep Rust (\`\#8C2D19\`) warning bars when a bag reaches 35 discs.  
\- \[ \] 3.3 Implement \*\*Ghost Slot\*\* rendering: insert dashed Desert Clay wishlist cards (\`\#E2DED4\`) into bag swimlanes when stability gaps are detected, linking directly to Screen 17\.  
\- \[ \] 3.4 Scaffold \`PutterLineupView\` (Screen 6\) with a top 35% sticky canvas rendering 2D quadratic Bézier aerodynamic flight curves (Factory Default vs Custom Reality).  
\- \[ \] 3.5 Build the \*\*1-to-10 Wear & Tear Slider\*\* in Dexie.js; implement the \*\*Automated Odometer Alert\*\* prompting a wear score reduction when base plastic exceeds 300 putts.  
\- \[ \] 3.6 Build the explicit \*\*Equipment Retirement Workflow (\`\[ ⚰️ RETIRE ASSET \]\`)\*\* in Screen 6 to archive broken/lost putters without losing career odometer stats.  
\- \[ \] 3.7 Scaffold \`RoutineBuilderView\` (Screen 7\) enforcing the \*\*100-Putt Fatigue Interlock\*\* (disabling stage additions if total putts exceed 100).  
\- \[ \] 3.8 Build the \*\*QR Beam Routine & Bag Generator\*\* (\`lz-string\` compression \+ QR rendering) for offline sharing across Screens 5 and 7\.

\#\#\# LAYER 4: HIGH-SPEED EXECUTION & TELEMETRY ENGINE  
\- \[ \] 4.1 Scaffold \`DashboardHubView\` (Screen 4\) featuring the Sunburst Orange streak badge and persistent bottom 4-tab navigation bar (\`PLAY\`, \`BAGS\`, \`STATS\`, \`PRO\`).  
\- \[ \] 4.2 Build the \*\*"Instant Replay" Hero Card\*\* and \*\*3-Way Routine Launchpad\*\* in Screen 4: wire up 1-tap direct mounting of Screen 8 and the \`\[ 👯 CLONE & TWEAK \]\` button.  
\- \[ \] 4.3 Scaffold \`ScoringCanvasView\` (Screen 8\) with a top stack tracker and massive 50% vertical split-screen touch targets (\`\[ MADE \]\` left / \`\[ MISSED \]\` right).  
\- \[ \] 4.4 Integrate native haptics into Screen 8: fire 50ms pulse on Made putts, double-pulse on Missed putts, and wire up the bottom-left Safety Undo button.  
\- \[ \] 4.5 Build the \*\*Web Speech API Audio Coach\*\* toggle in Screen 8: synthesize spoken stage instructions and acoustic scoring chimes.  
\- \[ \] 4.6 Implement the \*\*Bag-to-Weather Auto-Suggest Engine\*\*: when \>15mph wind or rain is selected in Screen 8, display an inline prompt to swap to assigned backup putters.  
\- \[ \] 4.7 Build \*\*Ad-Hoc Asset Substitution (\`\[ 🔄 SWAP \]\`)\*\* and \*\*Batch Stage Editing (\`\[ 📝 EDIT \]\`)\*\* shortcuts into Screen 8 for mid-set correction.  
\- \[ \] 4.8 Build the \*\*Low Battery / Cold Hands Panic Toggle\*\* in Screen 8 converting the entire display into a simplified single-tap scoring zone.  
\- \[ \] 4.9 Scaffold \`SessionSummaryView\` (Screen 9): render Putter Performance Breakdown tables auditing weather swap success rates and flag \>10% baseline distance drop-offs with \`⚠️\`.

\#\#\# LAYER 5: ANALYTICS, PROGRESSION & INGESTION  
\- \[ \] 5.1 Scaffold \`AnalyticsControlView\` (Screen 10): render interactive time-series accuracy charts (\`7\`, \`30\`, \`90\` days) with automated \*\*Ecosystem Milestone Injections ($★$)\*\*.  
\- \[ \] 5.2 Build the CSV Data Portability engine and protected \`\[ 🔴 CLEAR CACHE \]\` 2-step modal in Screen 10\.  
\- \[ \] 5.3 Scaffold \`PlayerCareerHubView\` (Screen 11\) featuring the verified PDGA badge, Target Rating progress bar, SVG Pentagon Skill Radar chart, and "Most Trusted Putter" query.  
\- \[ \] 5.4 Build the Supabase Edge Function \`fetch-pdga-profile\`: implement DOM/API scraping for official PDGA ratings and points with TanStack Query background caching.  
\- \[ \] 5.5 Scaffold \`TrophyRoomGamificationView\` (Screen 12\) featuring the Level 1–50 RPG XP progress bar, XP Ledger modal, Active Pursuits carousel, and 4-way filtered 3-column badge grid.  
\- \[ \] 5.6 Seed Dexie.js \`badges\` table with the 25 Master Achievement Badges; build \`BadgeEvaluatorService.ts\` executing offline post-session criteria evaluations.  
\- \[ \] 5.7 Scaffold \`UDiscDataIngestionView\` (Screen 13\) featuring the 1-tap CSV Drop Zone and step-by-step visual export instructions.  
\- \[ \] 5.8 Build the \*\*Granular UDisc CSV Parser Worker\*\*: extract round scores, parse hole-by-hole C1/C2 putting columns, update Dexie.js odometers, and award bulk retroactive XP.

\#\#\# LAYER 6: SOCIAL COMPETITION & LEAGUES  
\- \[ \] 6.1 Scaffold \`CoursePracticeHubView\` (Screen 14\) with GPS geo-fenced check-in pills, monthly local leaderboards, and zero-typing \`\[ 👊 FIST BUMP \]\` reaction feeds.  
\- \[ \] 6.2 Scaffold \`PuttingLeagueBracketView\` (Screen 15\) implementing offline Double Elimination / Round Robin bracket generation for 8 to 16 players.  
\- \[ \] 6.3 Build zero-typing numeric touch blocks in Screen 15 for 10-putt station rotations, wiring up automatic visual ASCII bracket advancing in Dexie.js.  
\- \[ \] 6.4 Implement the \*\*Virtual Bag Tag Challenge Engine\*\* in Screen 12 and Screen 15: build \`lz-string\` QR Beam generation and deterministic offline tie-break resolution (Sudden Death at $33\\text{ ft} \\rightarrow$ Streak Peak).  
\- \[ \] 6.5 Scaffold \`WearableSensorsHubView\` (Screen 16\) configuring minimalist Wrist-Tap watchOS face modes and BLE 5.0 smart basket chain vibration calibration.  
\- \[ \] 6.6 Scaffold \`ProShopDiscoveryView\` (Screen 17\) bridging Bag Ghost Slots and Odometer wear alerts directly to in-stock retail partners with 1-tap promo code copying.

\#\#\# LAYER 7: SAFETY, INTEGRITY & SYSTEM UTILITIES  
\- \[ \] 7.1 Scaffold \`SyncConflictView\` (Screen 18\) rendering side-by-side local vs cloud field comparisons during TanStack Query 409 collisions, implementing 1-tap domain merge resolution.  
\- \[ \] 7.2 Scaffold \`LegalDataHubView\` (Screen 19\) viewing GDPR/CCPA accordions and wiring up the irreversible 2-step \`\[ 🛡️ REQUEST TOTAL DATA PURGE \]\` Supabase deletion hook.  
\- \[ \] 7.3 Scaffold \`SensorDiagnosticsView\` (Screen 20\) rendering live BLE RSSI signal streams, real-time accelerometer impact waveforms, and Over-The-Air (OTA) firmware flash triggers.  
\- \[ \] 7.4 Scaffold \`AppEmergencyOverlay\` (Screen 21\) implementing deep-linkable panic-mode recovery: prioritized CSV log extraction, Dexie.js index rebuilding, and 2-step nuclear factory resets.  
\- \[ \] 7.5 Write comprehensive Jest unit tests verifying 35-disc bag limits, 100-putt regimen interlocks, Wear Score degradation math, and tie-break resolution algorithms.  
\- \[ \] 7.6 Write Maestro E2E YAML scripts automating the complete outdoor execution loop: launch app $\\rightarrow$ tap Hero Card $\\rightarrow$ log 10 split-screen putts $\\rightarrow$ verify Dexie persistence and summary rendering.

## **SECTION 7: FINAL SYSTEM VERIFICATION & HANDOFF PROTOCOL**

### **Verification Checklist Before Kicking Off Claude Code:**

1. **Zero-Typing Compliance Verified:** All 21 screens utilize 48px+ touch targets, segmented steppers, choice chips, or numeric blocks. No native OS keyboards are invoked across field modules.  
2. **Offline Autonomy Verified:** All database mutations target local Dexie.js tables first. TanStack Query background workers handle cloud replication asynchronously without blocking UI threads.  
3. **High-Luminance Contrast Verified:** Clinical white (\#FFFFFF) and black (\#000000) are stripped. All views strictly enforce Warm Sand (\#F4F1EA), Desert Clay (\#E2DED4), Deep Slate (\#1A1D1A), and Burnt Terracotta (\#CC4E3C).  
4. **Logic-Governance Contracts Verified:** Match state machines, deterministic tie-breaks, UDisc CSV deduplication rules, and exponential RPG leveling curves are explicitly defined.

### **How to Execute Handoff to Claude Code:**

1. Save this entire compiled text as **MASTER\_PROJECT\_BLUEPRINT.md** in your repository root.  
2. Extract Section 1 into CLAUDE.md, Section 2 into PRD.md / TECH\_STACK.md, Section 5 into DATABASE\_SCHEMA.md, and Section 6 into TASKS.md.  
3. Open your terminal in the workspace root and initiate your AI coding agent with the following seed command:*"Read CLAUDE.md and TASKS.md. Cross-reference MASTER\_PROJECT\_BLUEPRINT.md for full architectural context. Begin executing **Layer 1: Foundation & Data Architecture** strictly sequentially, marking tasks \[x\] upon verified completion."*

**Your project specification is 100% complete, fully consolidated, and ready for production scaffolding.**