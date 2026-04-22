# ArcZero Design System

This document outlines the core design decisions for ArcZero to ensure UI consistency as the project scales.

## 1. Core Aesthetic
**Neo-Arcade / Retro-Futuristic HUD**
ArcZero uses a minimalist, utilitarian interface resembling a military radar or terminal screen, overlaid with vibrant, arcade-style colors for interactive or critical elements.

## 2. Typography
- **Primary Font**: `"Courier New", monospace`
- **Characteristics**: Monospaced, highly legible, retro-terminal feel.
- **Usage**: Used globally across all UI elements (HUD, Menus, Leaderboards, Overlays). 
- **Letter Spacing**: Generous letter-spacing (e.g., `0.05em` to `0.15em`) is used for titles, buttons, and HUD elements to create a technical, "scanned" aesthetic.

## 3. Color Palette

### Base
- **Background**: `#0a0a0f` (Deep, dark navy/black)
- **Primary Text**: `#ffffff` (White, often at reduced opacities like `rgba(255, 255, 255, 0.5)` to `0.7`)

### Accents
- **Core Blue**: `#44aaff` (Used for primary selections, titles, active tabs)
- **Warning / Accent Orange**: `#ff9944` (Used for secondary actions, Daily Challenge highlights, selected elements)
- **Success / Good**: `#44ffee` (Used for player highlights in leaderboards)
- **Critical / Danger**: `#ff3535` / `#ff4444` (Used for game over titles, restart buttons)
- **Gold / Legendary**: `#ffd700` (Used for new personal bests, legendary chain callouts)

## 4. Components & Shapes

### Buttons
- **Style**: Ghost buttons (transparent backgrounds with solid borders).
- **Borders**: `1px solid rgba(255, 255, 255, 0.18)`
- **Border Radius**: Sharp or minimally rounded (`2px` to `4px`). No pill-shaped buttons.
- **Hover State**: 
  - Background gains slight opacity: `rgba(68, 170, 255, 0.12)`
  - Border changes to the primary color: `#44aaff` (or `#ff9944` for daily).
- **Padding**: Generous padding (e.g., `13px 36px` for primary buttons).

### Overlays & Modals
- **Background**: Semi-transparent dark wash: `rgba(10, 10, 15, 0.92)`
- **Layout**: Centered flex column, spaced with gaps (e.g., `16px`).
- **Cards**: ArcZero **does not use** distinct background cards or pop-up boxes within overlays. Content flows directly over the dark wash.

### HUD Elements
- **Containers**: Transparent boxes with very faint borders: `background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);`
- **Text**: Data labels in faint white `rgba(255, 255, 255, 0.5)`, values in bright white `#ffffff`.

### Toasts & Notifications
- **Style**: Small floating bordered blocks.
- **Colors**: `background: rgba(20, 20, 30, 0.9); border: 1px solid rgba(255, 255, 255, 0.18);`
- **Animation**: Quick slide-up and fade-in, followed by a delay and slide-up fade-out.

## 5. Layout and Spacing
- **Flexbox**: Extensively used for aligning menu items, HUD stats, and leaderboard rows.
- **No Clutter**: Elements are given space to breathe. Minimal lines, maximum contrast.
- **Alignment**: Center-aligned for menus, space-between for rows (like leaderboards and HUD).
