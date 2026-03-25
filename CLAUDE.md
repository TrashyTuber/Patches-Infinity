# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `patches/` subdirectory:

```bash
npm run dev       # Start dev server with HMR
npm run build     # Production build
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

## Architecture

The project is a React + Vite web-based puzzle game inspired by LinkedIn's Patches. The entire game lives in `patches/src/App.jsx` (~590 lines).

**Two key concerns in App.jsx:**

1. **Puzzle generation** (`generatePuzzle`, `attemptGenerate`, `getShapeHint`) — randomly partitions a grid into non-overlapping rectangles, assigns each a pastel color and a numeric clue. ~40% of tiles hide their number and show only a shape hint (square/tall/wide/any); ~30% of non-square rectangles become "any shape" hints.

2. **Game component** (`App`) — React component managing all game state via hooks. Handles drag-to-select interaction, validates placed rectangles (area must match clue, shape must match hint), tracks timer/moves, and renders the win screen.

**Game state (all React hooks in `App`):**
- `puzzle` — generated puzzle object with `grid`, `rects`, `clues`, `colors`
- `playerGrid` — 2D array tracking which rectangle ID occupies each cell
- `playerRects` — array of player-drawn rectangles
- `selection` — current drag selection bounds
- `solved` — win condition flag

**No external state management, no routing, no backend.** All logic is client-side.

**`patches_game.jsx`** at the repo root is an identical standalone copy of `App.jsx` — kept for reference, not imported anywhere.
