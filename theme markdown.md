# DESIGN SYSTEM SPECIFICATION: "SUN-DRENCHED TOPO" (OSWALD EDITION)
**Theme Identity:** Elevated Outdoor Adventure • Rugged & Tactile • High-Luminance Solar Glare Resistant  
**Design Inspiration:** Modern adventure hardware (e.g., Yeti, Garmin, AllTrails), desert topography, and elevated outdoor lifestyle apparel.  
**Core Objective:** Replace harsh clinical white (`#FFFFFF`) and unreadable woodland greens/browns with high-luminance, warm earth tones, bold color-blocking, and high-impact condensed typography that remains 100% legible under 10,000+ nits of direct noon sunlight.

---

## 1. DESIGN TOKENS & COLOR PALETTE
Do NOT use standard iOS/Android default colors or pure black/white. Inject these exact hexadecimal design tokens into your CSS variables, Tailwind configuration, or native stylesheet:

```json
{
  "theme": "sun_drenched_topo_oswald",
  "colors": {
    "background": {
      "primary": "#F4F1EA",   // Warm Sand / Parchment (Main app background, high luminance without blinding blue-light glare)
      "surface": "#E2DED4",   // Desert Clay (Card backgrounds, modals, elevated surfaces)
      "surface_alt": "#D6CEBF"// Deep Sand (Pressed states, secondary containers, dividers)
    },
    "text": {
      "primary": "#1A1D1A",   // Deep Slate (Replaces pure black; ultra-high contrast against sand background)
      "secondary": "#4A524A", // Muted Slate (Sub-labels, metadata, non-critical telemetry)
      "inverse": "#F4F1EA"    // Warm Sand (Text rendered inside dark or saturated accent buttons)
    },
    "interactive": {
      "positive_action": "#CC4E3C", // Burnt Terracotta (Primary CTAs, "Make" scoring zones, success states)
      "secondary_accent": "#2B5F6C",// Canyon Blue (Context bars, telemetry arcs, informational badges)
      "negative_action": "#8C2D19", // Deep Rust ("Miss" scoring zones, destructive actions, errors)
      "highlight": "#E87A30"        // Sunburst Orange (Active tab indicators, badges, star ratings)
    },
    "borders": {
      "default": "#C8C0B0",   // Structural dividers and card outlines (2px minimum thickness)
      "focus": "#1A1D1A"      // Deep Slate for high-visibility active states
    }
  }
}