---
name: Terra Nova Travel
colors:
  surface: '#fbf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#fbf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f0'
  surface-container: '#efeeeb'
  surface-container-high: '#eae8e5'
  surface-container-highest: '#e4e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#5b403b'
  inverse-surface: '#30312f'
  inverse-on-surface: '#f2f0ed'
  outline: '#8f706a'
  outline-variant: '#e4beb7'
  surface-tint: '#b6230c'
  primary: '#b32109'
  on-primary: '#ffffff'
  primary-container: '#d63b22'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb4a6'
  secondary: '#8d4f00'
  on-secondary: '#ffffff'
  secondary-container: '#ffa03b'
  on-secondary-container: '#6c3b00'
  tertiary: '#026a46'
  on-tertiary: '#ffffff'
  tertiary-container: '#2c835d'
  on-tertiary-container: '#f6fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad3'
  primary-fixed-dim: '#ffb4a6'
  on-primary-fixed: '#3f0300'
  on-primary-fixed-variant: '#8f1000'
  secondary-fixed: '#ffdcc0'
  secondary-fixed-dim: '#ffb875'
  on-secondary-fixed: '#2d1600'
  on-secondary-fixed-variant: '#6b3b00'
  tertiary-fixed: '#9ff4c6'
  tertiary-fixed-dim: '#83d8ab'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005235'
  background: '#fbf9f6'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2df'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.75rem
  margin: 1rem
  margin-tablet: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system embodies modern wanderlust—combining the curated, inspiration-rich editorial eye of high-end travel journalism with the utility of collaborative real-time coordination. It avoids sterile corporate patterns and generic booking engine conventions in favor of a tactile, photography-forward aesthetic that feels sun-drenched, sophisticated, and kinetic.

### Target Audience & Emotional Impact
Designed for creative travelers, group journey planners, and experiential nomads who value aesthetics as much as operational clarity. The UI evokes:
- **Anticipation & Exploration:** Generous edge-to-edge imagery, rich travel stats, and golden-hour hues spark emotional investment.
- **Collaborative Calm:** Clutter-free workspaces where itineraries, split budgets, live chat streams, and pinned locations coexist harmoniously without cognitive overload.
- **Effortless Tactility:** Touch-driven gestures, spring-physics micro-interactions, and deeply refined Material 3 surface physics provide immediate, satisfying tactile feedback.

### Visual Style
A hybrid of **Warm Modern Editorial** and **Tactile Glass-Infused Material 3**. High-contrast visual cards float atop warm parchment and sand undertones, punctuated by terracotta and sunset coral accents. Soft, natural tinted ambient shadows replace sterile cool grays, providing sunlit depth reminiscent of travel diaries and architectural lookbooks.

## Colors

The palette draws directly from geological strata, coastal skylines, and baked earth. It eschews pure synthetic RGB primaries and cold #FFFFFF surfaces in favor of an organic, sun-drenched foundation.

### Palette Roles & Distribution

- **Canvas & Structural Neutrals (`#FAF8F5`, `#F3EFEA`):** The primary backdrop is a warm calcified sand (`#FAF8F5`), shifting to weathered parchment (`#F3EFEA`) for nested containers, card wells, and background segments.
- **High-Contrast Deep Slate (`#181A1B`):** Pure black is avoided. Volcanic slate provides deep, legible typography, bottom app bar structures, and high-emphasis floating pill containers.
- **Sunset Terracotta Primary (`#FA5438`):** The central brand catalyst. Applied deliberately to primary CTAs, active tab indicators, central action triggers, and vital interactive badges.
- **Golden Hour Secondary (`#E08722`):** Highlights ratings, curated editor picks, weather forecasts, time-sensitive itinerary alerts, and golden bookmark saves.
- **Sage Exploration Green (`#2B825C`):** Used for confirmed itinerary statuses, active booking confirmations, outdoor trail metrics, and collaborative presence beacons.
- **Clear Ocean Cyan (`#1C7ED6`):** Reserved for spatial and interactive discovery—live transit tracking, interactive map pin highlights, flight path vectors, and dynamic AI assistant interactions.

### Contrast & State Logic
- Interactive interactive states leverage a subtle 8% overlay of `#181A1B` in light surfaces, and 12% white overlay against dark surfaces.
- Disabled states drop container fills to `#E8E3DC` with text falling to a muted stone tint (`#8C877D`).

## Typography

Plus Jakarta Sans provides geometric warmth, wide counters, and humanistic terminals suited for high-density travel metadata and evocative destination titles.

### Hierarchy & Editorial Handling
- **Display & Large Headlines:** Used for trip naming, country entry points, and visual hero cards. Rendered in weights 700 and 800 with tight negative letter tracking to produce a punchy, magazine-cover presence.
- **Editorial Legibility:** Body copy maintains an open line-height to ensure destination descriptions, trip guidelines, and conversational travel assistant exchanges remain effortless to read on high-DPI mobile screens under bright outdoor conditions.
- **Uppercase Labels:** Small labels, category tags, flight codes, and status pills utilize `label-sm` with widened letter-spacing (`0.04em`) to maintain sharp legibility when superimposed over high-detail travel photography.

## Layout & Spacing

The layout is grounded in a rigorous 8pt spatial grid with dynamic fluid margins tailored for one-handed mobile ergonomics and staggered multi-column discovery.

### Grid & Viewport Transitions
- **Mobile (Up to 599dp):** A single-window fluid canvas with `margin: 1rem` (16dp). Pinterest-style mood boards and discovery streams adopt an asymmetric 2-column masonry staggered layout with `gutter-compact: 0.75rem` (12dp) to maximize photo surface area.
- **Tablet & Foldables (600dp - 1023dp):** Fluid 6-column to 8-column layout with `margin-tablet: 2rem` (32dp) and `gutter: 1rem` (16dp). Split-view pattern becomes active: Itinerary timeline resides on the left rail (40% width), while map exploration or visual moodboards occupy the primary space (60% width).
- **Safe Area Insets:** Strict adherence to Android 15 edge-to-edge system gestures. Top app bars contain a minimum 56dp height stacked below the system status bar. The custom bottom navigation dock accounts for system navigation pill insets, floating 16dp above the display base.

## Elevation & Depth

Visual hierarchy uses warm ambient lighting rather than flat gray drop shadows. Cast shadows borrow tone directly from volcanic slate mixed with terracotta amber undertones (`rgba(24, 26, 27, 0.08)` to `rgba(84, 42, 30, 0.14)`), preventing muddy dark gradients on sand backgrounds.

### Elevation Levels

- **Level 0 (Flat Canvas):** `#FAF8F5`. Used strictly for root screens, background viewports, and deep map tiles.
- **Level 1 (Resting Cards & Surfaces):** `#FFFFFF` or `#F3EFEA`. Soft, diffused drop: `0px 2px 8px -2px rgba(24, 26, 27, 0.04), 0px 4px 16px 0px rgba(84, 42, 30, 0.04)`. Applied to resting discovery cards, unselected itinerary modules, and settings rows.
- **Level 2 (Interactive Floating & Pinned Elements):** `0px 6px 20px -4px rgba(24, 26, 27, 0.08), 0px 10px 24px -2px rgba(84, 42, 30, 0.06)`. Applied to the bottom navigation bar, collaborator floating avatar stacks, and pinned map view toggles.
- **Level 3 (Modal & Assistant Overlays):** `0px 12px 36px -6px rgba(24, 26, 27, 0.14), 0px 20px 48px -4px rgba(84, 42, 30, 0.08)`. Applied to bottom sheets, AI conversational prompts, and media lightbox overlays.

### Glassmorphism & Translucency
Floating interface elements (e.g., floating image badges, dynamic map toolbars, top header blur) utilize backdrop blur filters (`blur(20px)`) combined with a 75% translucent sand surface (`rgba(250, 248, 245, 0.75)`) and a delicate 1px border of `rgba(255, 255, 255, 0.6)`.

## Shapes

The interface embraces organic curvature without falling into full bubble-geometry. 

### Corner Radius Mapping
- **Corner Scale:** Standard components utilize a baseline 16px (`rounded-lg`, 1rem), scaling to 24px (`rounded-xl`, 1.5rem) for prominent card surfaces, modals, and moodboard items.
- **Full Pill Geometry (`rounded-full`):** Reserved for interactive interactive buttons, search bars, category discovery chips, and the standout central "Create" trigger.
- **Nested Ratio Consistency:** When containers are nested inside cards (e.g., collaborator avatars, badges, thumbnail media), inner radius = outer radius minus inner padding. This eliminates awkward optical corners and maintains harmonious concentricity.

## Components

### Buttons
- **Primary Action:** Pill-shaped (`rounded-full`), saturated Terracotta (`#FA5438`) fill with pure white typography (`label-lg`). Includes an inset gradient sheen (`linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.06) 100%)`). Minimum touch target 48dp height; horizontal padding 24dp.
- **Secondary & Ghost:** Warm sand container (`#F3EFEA`) with Slate text (`#181A1B`). In ghost mode, surface is transparent with 1.5px border of `#E8E3DC`.
- **Standout 'Create' Dock Action:** Central bottom-dock floating trigger. Sized at 56x56dp circular or 56dp pill, wrapped with a 4dp ring of canvas sand (`#FAF8F5`) to cleanly visually slice through the navigation bar background.

### Chips & Badges
- **Category Filter Chips:** 36dp height, pill-shaped. Inactive state: `#F3EFEA` surface with Slate text. Active state: `#181A1B` fill with `#FAF8F5` text, or tinted with category accents (e.g., Ocean Cyan for "Water Activities", Sage for "Nature & Parks").
- **Overlay Media Badges:** Floating chips positioned over photography. Translucent slate (`rgba(24, 26, 27, 0.6)`) with `backdrop-filter: blur(12px)`, crisp white text, and micro-icons (rating star in `#E08722`, pin in `#FA5438`).

### Cards & Moodboard Tiles
- **Discovery Media Cards:** 16-24px rounded corners, 0-border with Level 1 warm elevation. Photography spans edge-to-edge with a subtle bottom 40% height dark gradient (`linear-gradient(180deg, transparent 0%, rgba(24,26,27,0.7) 100%)`) to guarantee label and collaborator legibility.
- **Itinerary Timeline Cards:** Horizontal structure with a vertical itinerary route marker. Features time slot, activity badge, booking status badge (`#2B825C` tint for confirmed), and collaborator presence indicators.

### Collaborator Avatar Stacks
- 32dp circles bordered by a crisp 2dp canvas edge (`#FAF8F5`). Overlap by -8dp. If unassigned or open for co-planners, an outline-dashed pill button with a plus icon sits at the end of the stack.

### Inputs & Search Bars
- Search bar uses an expansive 52dp pill container filled with `#F3EFEA`. Active focus introduces a 1.5px Terracotta accent border (`#FA5438`) and replaces the static search icon with an animated clearing or AI prompt spark.
- Form fields utilize floating labels in `label-md`, 16px radius, with subtle 1px `#E8E3DC` borders that thicken to 2px on interaction.

### Live Chat & AI Assistant Sheets
- **Chat Bubbles:** User messages in `#181A1B` with white text; incoming collaborator messages in `#FFFFFF` with `#181A1B` text and subtle warm shadow.
- **Integrated AI Assistant:** Differentiated through an Ocean Cyan to Sunset Coral gradient accent (`#1C7ED6` to `#FA5438`) on borders and sparkle accents, presenting curated suggestions directly into trip itinerary drop-zones as dismissible interactive draft blocks.