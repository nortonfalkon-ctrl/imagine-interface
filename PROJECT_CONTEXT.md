# Imagine Interface — AI Project Context

This document is intended to be uploaded together with the project archive when starting a new ChatGPT conversation.

## Project

Imagine Interface is a long-term module for Foundry VTT v13 that replaces and extends the standard interface with a premium MMORPG-inspired UI.

Current release: **v0.9.18**

Repository:
https://github.com/nortonfalkon-ctrl/imagine-interface

Manifest:
https://github.com/nortonfalkon-ctrl/imagine-interface/releases/latest/download/module.json

Latest release package:
https://github.com/nortonfalkon-ctrl/imagine-interface/releases/latest/download/imagine-interface-v0.9.18.zip

## Design goals

- Premium fantasy MMORPG appearance.
- Black and metallic visual language.
- Configurable metal color schemes.
- Minimal invasive architecture.
- High compatibility with Foundry VTT v13.
- Prefer extending existing Foundry systems instead of replacing them.
- Preserve backward compatibility with existing saved action bar data.

## Visual style

The module uses a dark fantasy UI style:

- Black and near-black backgrounds.
- Metallic borders and highlights.
- Warm glow or cold metallic glow depending on the selected theme.
- Beveled fantasy/MMORPG controls.
- No flat design.
- No glassmorphism.
- No neon colors.

Every new UI element should visually match the existing Imagine Interface style.

## Current color schemes

The module supports selectable color schemes.

Available schemes:

- **Gold** — original Imagine Interface style.
- **Silver** — cold silver/gray metal.
- **Bronze** — warm copper/bronze metal.
- **Steel** — cold blue-gray steel metal.

The current color scheme can be changed from:

- Foundry module settings.
- The internal Imagine Interface settings menu opened from the module gear button.

The color system is based on CSS variables. New themed UI elements should use existing theme variables instead of hardcoded gold colors.

Important: hover highlights, button borders, active states, glows, and scrollbars should follow the selected color scheme.

## Implemented features

### Action Bars

- Multiple movable action bars.
- Total bars: **10**.
- Slots per bar: **10**.
- Pages per bar: **5**.
- Horizontal layout.
- Vertical-up layout.
- Vertical-down layout.
- Independent panel visibility.
- Independent panel configuration.
- Drag & Drop support.
- Hotkeys.
- Lock/unlock panels.
- Setup mode.
- Show/hide panels from the internal settings menu.
- Panel-specific gear menus for keybind configuration.

### Internal Settings Menu

Opened from the Imagine Interface gear button.

Current menu features:

- Color scheme selector.
- Sound toggle.
- Setup mode toggle.
- Visibility toggle for each of the 10 action bars.
- Gear button for each panel.
- Per-panel hotkey setup.

The settings menu is styled with the active color scheme.

### Tooltips

Custom tooltip system with:

- Pinning.
- Scrolling.
- Close button.
- Text selection.
- Localization.
- Compendium links.

Tooltip styling should follow the active Imagine Interface theme.

### Dice Tray / Chat Dice Controls

The module includes styled chat dice controls using text buttons:

- d4
- d6
- d8
- d10
- d12
- d20
- d100

Hover tooltips for dice buttons are intentionally disabled.

Important asset cleanup:

- Old dice SVG icons are no longer used.
- Old dice token/icon images are no longer used.
- The `assets` folder should only contain `empty-slot.webp` unless new assets are intentionally added.
- No old dice SVG/icon assets should remain in the repository.

### Theme

The module restyles the default Foundry UI into a consistent dark metallic theme.

The following should follow the active color scheme:

- Imagine Interface action bars.
- Internal settings menu.
- Buttons.
- Hover states.
- Active states.
- Borders.
- Glow effects.
- Scrollbars.
- Tooltip styling.
- Token distance marker.

### Token Distance Hover Marker

Added in **v0.9.18**.

When one token is selected, hovering another token shows a distance marker above the hovered token.

The marker calculates real 3D distance using:

- Horizontal grid distance.
- Vertical elevation difference between the selected token and hovered token.

Formula:

```text
real distance = sqrt(horizontal distance^2 + elevation difference^2)
```

Example:

```text
horizontal distance = 10 ft
elevation difference = 20 ft
real distance = sqrt(10^2 + 20^2) ≈ 22.4 ft
```

So the correct 3D distance is about **22.4 ft**, not **30 ft**.

The distance marker should:

- Appear only when a token is selected and the cursor hovers another token.
- Use the selected token as the observer/source.
- Use the hovered token as the target.
- Account for both tokens' elevation values.
- Be styled in the active Imagine Interface color scheme.

There is also a module setting to enable/disable the token distance marker.

## Project structure

```text
assets/
lang/
scripts/
styles/
module.json
PROJECT_CONTEXT.md
README.md
CHANGELOG.md
ROADMAP.md
.gitignore
```

Main files:

```text
scripts/imagine-interface.js
styles/imagine-interface.css
lang/ru.json
lang/en.json
module.json
```

Current important asset expectation:

```text
assets/empty-slot.webp
```

No old dice SVG/icon assets should remain in the repository.

## GitHub releases

Each GitHub release should contain exactly these downloadable assets:

```text
imagine-interface-vX.X.X.zip
module.json
```

Important packaging rule:

The archive filename should be versioned:

```text
imagine-interface-v0.9.18.zip
```

The folder inside the archive must always be named exactly:

```text
imagine-interface/
```

Do not name the inner folder `imagine-interface-v0.9.18`.

Correct archive structure:

```text
imagine-interface-v0.9.18.zip
└─ imagine-interface/
   ├─ assets/
   ├─ lang/
   ├─ scripts/
   ├─ styles/
   ├─ module.json
   └─ ...
```

## Recent release history

### v0.9.15

Current baseline from the earlier project context.

Already implemented:

- Action bars.
- Tooltips.
- Dice tray.
- Foundry UI restyling.

### v0.9.16

Added configurable color schemes:

- Gold.
- Silver.
- Bronze.
- Steel.

Also added color scheme selection to:

- Foundry module settings.
- Imagine Interface internal settings menu.

Converted core UI colors to theme variables.

Removed unused dice icon assets from intended package contents.

### v0.9.17

Fixed theme consistency problems:

- Foundry button hover highlights now follow the selected color scheme.
- Scrollbar colors now follow the selected color scheme.
- Internal menu and UI hover/active states better respect the active scheme.

Repository cleanup:

- Removed old dice SVG files.
- Removed old dice token/icon files.
- Confirmed `assets` should only keep `empty-slot.webp`.

### v0.9.18

Added token distance hover marker:

- Select one token.
- Hover another token.
- A distance marker appears above the hovered token.
- Distance uses real 3D calculation with elevation difference.
- Marker styling follows the selected color scheme.

Updated release assets:

```text
imagine-interface-v0.9.18.zip
module.json
```

## Development rules

1. Read existing code first.
2. Prefer minimal local fixes.
3. Preserve backward compatibility.
4. Avoid unnecessary rewrites.
5. Match the existing UI style.
6. Use CSS variables for color-theme-sensitive styling.
7. Do not reintroduce unused dice SVG/icon assets.
8. Keep Foundry VTT v13 compatibility.
9. Prefer extending existing Foundry systems instead of replacing them.
10. Keep the archive inner folder named exactly `imagine-interface`.

## Instructions for ChatGPT

Treat this document as the project context.

Continue development from the current state instead of restarting the project design.

When asked to build a new version:

1. Update the module version in `module.json`.
2. Keep the repository structure intact.
3. Keep the inner archive folder named `imagine-interface`.
4. Package the release as `imagine-interface-vX.X.X.zip`.
5. Also provide a standalone `module.json` for the GitHub release.
6. Ensure `assets` does not contain removed dice/icon files unless explicitly requested.
7. Keep styling consistent across all color schemes.
8. Test JavaScript syntax if possible before returning files.
