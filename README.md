# Chess Notation Trainer

A free, offline webapp that teaches **chess notation by doing** — no accounts, no
network, no dependencies. One HTML file, built to be beginner-friendly: clear,
warm, and never condescending.

Built by [Asdale Dynamics, LLC](https://dylanasdale.github.io) (the LLC behind
*The Massive AI Manual*). MIT licensed, see [LICENSE](LICENSE).

## What is in it

- **Name the square** — the app highlights a square and asks you to type its
  algebraic name (like `e4`). A color hint ("dark" or "light") helps you audit
  yourself while you learn the grid.
- **Decode a move** — you see a real position and a real move in standard
  algebraic notation (like `Nf3`); you name the square it lands on. When you
  answer, the move plays out with a board arrow so you can check yourself.
- **Read a game** — step through public-domain classics line by line using the
  built-in score: the 1858 Opera Game (Morphy), Lasker & Thomas's 1912 immortal
  king walk, and the fastest possible loss. Playback arrows mark the latest move;
  the current score line is highlighted.
- **Daily drill** — a five-minute timed session mixing both drill types. Finish
  the whole five minutes to extend your streak, stored in `localStorage`.

## How to run it

No install, no build, no server:

1. Download or clone this folder.
2. Double-click `index.html` (or open it in any modern browser from `file://`).
3. Works offline forever after that.

Everything is one file. Deleting your browser data resets the streak; nothing
else is stored or transmitted.

## Accessibility

- All drill answering works from the keyboard: type the square name and press
  Enter. Clicking or tapping squares is optional.
- The board also supports arrow-key square selection (Enter to pick a square),
  and the game reader uses Left/Right arrow keys plus Home/End — matching the
  on-screen buttons.
- Answer feedback and move narration are announced through ARIA live regions;
  the visual board is a reinforcement, not a requirement.
- Focus outlines are strong, contrast is high, and `prefers-reduced-motion`
  is respected.

## Tests

A plain-`assert` harness (no test framework) covers the notation engine —
square/date notation, SAN parsing, move application, castling, and replaying
every bundled game from move one — plus a UI smoke test that drives all three
panels through a minimal DOM shim:

```sh
node test/test.js    # engine unit tests
node test/smoke.js   # UI smoke tests
npm test             # both
```

## Files

- `index.html` — the entire app (styles, logic, UI).
- `test/test.js`, `test/smoke.js` — the test harnesses.
- `LICENSE` — MIT, Copyright (c) 2026 Asdale Dynamics, LLC.
- `STATUS.md` — what was built and what still needs work.

## Why it exists

Beginner chess players stall on notation: they can see the board but can't read
the score. Practicing the *reading itself* — naming squares and decoding moves —
is the fastest way past that wall. This tool does exactly that, with real
famous games so the practice feels alive.

This is a companion to, and distinct from, Asdale Dynamics' two-player chess
board, tactics postmortem, and PGN MCP server projects.

---

Copyright (c) 2026 Asdale Dynamics, LLC. MIT License. No secrets, no personal
data, no tracking.
