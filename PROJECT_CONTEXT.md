# PROJECT_CONTEXT.md

# Imagine Interface — AI Project Context

This document is intended to be uploaded together with the project archive when starting a new ChatGPT conversation.

## Project

Imagine Interface is a long-term module for Foundry VTT v13 that replaces and extends the standard interface with a premium MMORPG-inspired UI.

Current release: **v0.9.15**

Repository:
https://github.com/nortonfalkon-ctrl/imagine-interface

## Design goals

- Premium fantasy MMORPG appearance.
- Black and gold visual language.
- Minimal invasive architecture.
- High compatibility with Foundry VTT v13.
- Prefer extending existing systems instead of replacing them.

## Visual style

- Black backgrounds.
- Dark gold borders.
- Warm amber glow.
- Metallic fantasy appearance.
- No flat design.
- No glassmorphism.
- No neon colors.

Every new UI element should visually match the existing Imagine Interface style.

## Implemented features

### Action Bars
- Multiple movable action bars.
- Horizontal and vertical layouts.
- Independent configuration.
- Drag & Drop.
- Hotkeys.
- Show / hide panels.

### Tooltips
Custom tooltip system with pinning, scrolling, close button, text selection, localization and Compendium links.

### Dice Tray
Uses styled text buttons:
d4, d6, d8, d10, d12, d20, d100.
Hover tooltips are intentionally disabled.

### Theme
The module restyles the default Foundry UI into a consistent black-and-gold theme.

## Project structure

assets/
lang/
scripts/
styles/

module.json

Main files:
- scripts/imagine-interface.js
- styles/imagine-interface.css

## GitHub releases

Each release contains:
- imagine-interface-vX.X.X.zip
- module.json

Manifest:
https://github.com/nortonfalkon-ctrl/imagine-interface/releases/latest/download/module.json

## Development rules

1. Read existing code first.
2. Prefer minimal local fixes.
3. Preserve backward compatibility.
4. Avoid unnecessary rewrites.
5. Match the existing UI style.

## Instructions for ChatGPT

Treat this document as the project context.
Continue development from the current state instead of restarting project design.
