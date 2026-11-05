# STATUS — Chess Notation Trainer

Last updated: 2026-11-05

## What was built

A single-file, dependency-free, offline webapp (`index.html`, ~1,300 lines)
teaching chess notation by doing:

1. **Name-the-square drills** (`Drills` tab → "Name the square"): a square is
   highlighted on the rendered board; the learner types its algebraic name
   (e.g. `e4`). Includes a dark/light color hint and instant feedback.
2. **Decode-a-move drills** (`Drills` tab → "Decode a move"): a real position
   from one of the bundled games is shown with a SAN move (e.g. `Nf3`); the
   learner names the destination square. Answering reveals the correct move as
   a board arrow plus a highlighted destination square.
3. **Read a game** (`Read a game` tab): three public-domain games with a
   position. The latest move is drawn with an arrow, the current SAN token is
   highlighted, and a plain-English description of each move is spoken to ARIA
   live regions. Games: Morphy's 1858 Opera Game (1-0, queen restores order and
   mate falls on 17.Rd8#), Lasker–Thomas 1912 "immortal king walk" (ends
   18.Kd2#), and the two-move fool's mate as a cautionary tale.
4. **Five-minute daily drill streak** (`Daily drill` tab): a timed 300-second
   session mixing both drill types. Completing the full five minutes updates a
   calendar-day streak saved to `localStorage` (key
   `chess-notation-trainer-v1`). Ending early records nothing; repeating the
   same day cannot inflate the streak.

Also included: keyboard-first controls everywhere (typing answers with Enter,
arrow-key square selection on the board, Left/Right/Home/End playback, arrow-key
tab switching), ARIA live regions for feedback, focus-visible outlines, high
contrast, `prefers-reduced-motion` support, and a graceful no-JavaScript notice.

## How to run it

Open `index.html` in any modern browser — double-clicking it from `file://`
works, as designed; no server, build step, or internet needed. Offline
everything still works; the only storage is the local streak.

## Verification results

Both harnesses use Node's built-in `assert` only (no framework):

- `node test/test.js` — **29/29 tests pass.** Covers square-name ⇄ index
  round-trips for all 64 squares, color parity, `renderSquares()` output, SAN
  parsing (pieces, disambiguation, captures, castling `O-O`/`O-O-O`/`0-0`,
  promotions, check/mate suffixes, junk rejection), initial placement,
  `applySan` behavior (including not stepping into check, castling both sides),
  move-list parsing, full replay of all three bundled games from the starting
  position with known-position assertions (e.g. Opera Game: white rook lands on
  d8 delivering mate; Lasker: `Neg4+` disambiguation from e5, final
  18.Kd2# mate with black king on g1), and streak math (first day, consecutive
  days, same-day no-op, gap reset, leap-day-accurate date math).
- `node test/smoke.js` — **12/12 checks pass.** Runs the actual UI script from
  `index.html` against a minimal DOM shim: boots with the drills panel visible
  and 64 squares rendered, typing and board-click answers both count
  (format errors don't), skip works, decode drills draw arrows, all three games
  walk through with arrows/current-move highlighting, arrow/Home/End playback
  keys fire at document level, a full 5-minute session marks the streak in
  `localStorage`, an early end leaves it alone, and tabs round-trip.
- `npm test` runs both.

Bugs found and fixed during verification: a rank/file indexing error in
`squareToIndex`, a row/col mixup in pawn generation and the attack ray-walker
(a queen vs. (2,3)-offset loop could hang forever), an inverted en-passant
capture offset, dead square-click handling (`dataset.square` was only set when
pick handlers were configured), and an SVG arrow overlay that covered the
coordinate strip.

## Known gaps / honest limitations

- The move-to-square drill generator uses the three bundled games, so
  decode questions come from real (but finite) positions. There is no random
  position generator — by design, to keep position/answers guaranteed legal.
- SAN reading is not a full chess engine: it does not verify checkmate, does
  not track repetition/50-move/fifty-anything, and treats authored games as
  legal (it does filter for moves that leave the mover's king safe, and picks
  disambiguated candidates).
- En passant is parsed and applied, but the replay never sets an en-passant
  target square between plies (none of the bundled games need it).
- Decoded-move questions for pawn captures like `exd5` ask about the landing
  square only; they do not quiz the capturing square ("which pawn captured?").
- No pointer-drag piece movement anywhere; this app reads and names squares,
  it does not play chess (the two-player board app covers that).
- The streak uses the device's local calendar day and local browser storage;
  syncing across devices is intentionally out of scope for a privacy-first,
  offline tool.
- The UI smoke test drives a shimmed DOM; real-browser quirks (e.g. exotic
  pointer devices, screen-reader specifics) are covered only by the reasonable
  ARIA/EK structure, not automated tests.
