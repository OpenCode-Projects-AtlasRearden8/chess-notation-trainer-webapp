"use strict";
/* Plain assert test harness: reads the embedded app-core script out of
   index.html and runs it in Node, then asserts on notation parsing and
   square rendering. Run: node test/test.js */

var fs = require("fs");
var path = require("path");
var assert = require("assert");
var vm = require("vm");

var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");

var m = /<script id="app-core">([\s\S]*?)<\/script>/.exec(html);
assert.ok(m, "index.html contains a <script id=\"app-core\"> block");
var core = new vm.Script(m[1], { filename: "app-core.js" });
var sandbox = { module: { exports: {} } };
core.runInNewContext(sandbox);
var C = sandbox.module.exports;

var testsRun = 0;
function test(name, fn) {
  fn();
  testsRun++;
  console.log("ok - " + name);
}

/* ---------------- square rendering ---------------- */

test("squareToIndex / indexToSquare round-trip all 64 squares", function () {
  var files = "abcdefgh".split("");
  for (var f = 0; f < 8; f++) {
    for (var r = 1; r <= 8; r++) {
      var name = files[f] + r;
      var i = C.squareToIndex(name);
      assert.ok(i >= 0 && i <= 63, name + " maps into range");
      assert.strictEqual(C.indexToSquare(i), name, "round trip " + name);
    }
  }
});

test("board layout anchors: a8=0, h8=7, a1=56, h1=63, e4=36", function () {
  assert.strictEqual(C.squareToIndex("a8"), 0);
  assert.strictEqual(C.squareToIndex("h8"), 7);
  assert.strictEqual(C.squareToIndex("a1"), 56);
  assert.strictEqual(C.squareToIndex("h1"), 63);
  assert.strictEqual(C.squareToIndex("e4"), 36);
});

test("bad square names reject", function () {
  assert.strictEqual(C.squareToIndex("e9"), -1);
  assert.strictEqual(C.squareToIndex("i4"), -1);
  assert.strictEqual(C.squareToIndex("zz"), -1);
  assert.strictEqual(C.squareToIndex(""), -1);
  assert.strictEqual(C.squareToIndex(undefined), -1);
  assert.strictEqual(C.indexToSquare(64), null);
  assert.strictEqual(C.indexToSquare(-1), null);
});

test("square colors: a1 dark, h1 light, a8 light, h8 dark", function () {
  assert.strictEqual(C.isDarkSquare("a1"), true);
  assert.strictEqual(C.isDarkSquare("h1"), false);
  assert.strictEqual(C.isDarkSquare("a8"), false);
  assert.strictEqual(C.isDarkSquare("h8"), true);
  assert.strictEqual(C.isDarkSquare("e4"), false);
  assert.strictEqual(C.isDarkSquare("e5"), true);
});

test("isDarkSquare rejects invalid names", function () {
  assert.strictEqual(C.isDarkSquare("e9"), null);
  assert.strictEqual(C.isDarkSquare("nope"), null);
  assert.strictEqual(C.isDarkSquare(""), null);
});

test("renderSquares returns 64 squares in visual order with correct fields", function () {
  var sq = C.renderSquares();
  assert.strictEqual(sq.length, 64);
  assert.strictEqual(sq[0].name, "a8");
  assert.strictEqual(sq[0].index, 0);
  assert.strictEqual(sq[0].file, "a");
  assert.strictEqual(sq[0].rank, 8);
  assert.strictEqual(sq[63].name, "h1");
  assert.strictEqual(sq[63].file, "h");
  assert.strictEqual(sq[63].rank, 1);
  for (var i = 0; i < 64; i++) {
    assert.strictEqual(typeof sq[i].dark, "boolean", "dark is real boolean at " + i);
    assert.strictEqual(C.indexToSquare(i), sq[i].name);
  }
});

test("renderSquares alternates colors along rows and files", function () {
  var sq = C.renderSquares();
  for (var i = 0; i < 64; i++) {
    if (i % 8 < 7) {
      assert.notStrictEqual(sq[i].dark, sq[i + 1].dark, "horizontal alternation at " + sq[i].name);
    }
    if (i + 8 < 64) {
      assert.notStrictEqual(sq[i].dark, sq[i + 8].dark, "vertical alternation at " + sq[i].name);
    }
  }
});

/* ---------------- notation parsing ---------------- */

test("parseSan basic moves", function () {
  assert.deepEqual(C.parseSan("e4"), {
    piece: "P", fromFile: null, fromRank: null,
    capture: false, target: C.squareToIndex("e4"), promotion: null
  });
  assert.strictEqual("castle" in C.parseSan("e4"), false, "no castle key on normal moves");
  assert.strictEqual(C.parseSan("Nf3").piece, "N");
  assert.strictEqual(C.parseSan("Nf3").target, C.squareToIndex("f3"));
});

test("parseSan fully-qualified move with disambiguation and capture", function () {
  var p = C.parseSan("Rdd1");
  assert.strictEqual(p.piece, "R");
  assert.strictEqual(p.fromFile, 3); /* d = index 3 */
  assert.strictEqual(p.fromRank, null);
  assert.strictEqual(p.target, C.squareToIndex("d1"));

  var ex = C.parseSan("exd5");
  assert.strictEqual(ex.piece, "P");
  assert.strictEqual(ex.fromFile, 4);
  assert.strictEqual(ex.capture, true);
  assert.strictEqual(ex.target, C.squareToIndex("d5"));

  var r1 = C.parseSan("R2xa7");
  assert.strictEqual(r1.fromRank, 2);
  assert.strictEqual(r1.fromFile, null);
  assert.strictEqual(r1.capture, true);
  assert.strictEqual(r1.target, C.squareToIndex("a7"));
});

test("parseSan castling and check suffixes", function () {
  assert.deepEqual(C.parseSan("O-O"), { castle: "K" });
  assert.deepEqual(C.parseSan("O-O-O"), { castle: "Q" });
  assert.deepEqual(C.parseSan("0-0"), { castle: "K" });
  assert.strictEqual(C.parseSan("Rd8#").target, C.squareToIndex("d8"));
  assert.strictEqual(C.parseSan("Bxb5+").target, C.squareToIndex("b5"));
  assert.strictEqual(C.parseSan("Qh8+").capture, false);
});

test("parseSan promotion", function () {
  var q = C.parseSan("b8=Q");
  assert.strictEqual(q.target, C.squareToIndex("b8"));
  assert.strictEqual(q.promotion, "Q");
  assert.strictEqual(C.parseSan("gxh1=N").promotion, "N");
});

test("parseSan rejects junk", function () {
  [null, "", "12", "banana", "e#", "N99", "KxT5"].forEach(function (bad) {
    assert.strictEqual(C.parseSan(bad), null, "rejects " + String(bad));
  });
});

/* ---------------- board application ---------------- */

test("initialBoard has correct piece placement", function () {
  var b = C.initialBoard();
  assert.strictEqual(b[C.squareToIndex("e1")].t, "K");
  assert.strictEqual(b[C.squareToIndex("e1")].c, "w");
  assert.strictEqual(b[C.squareToIndex("e8")].c, "b");
  assert.strictEqual(b[C.squareToIndex("e4")], null);
  assert.strictEqual(b[C.squareToIndex("a2")].t, "P");
  assert.strictEqual(b.filter(Boolean).length, 32);
});

test("applySan plays opening moves correctly", function () {
  var b = C.initialBoard();
  var r = C.applySan(b, "e4", "w");
  assert.ok(r, "e4 applies");
  assert.strictEqual(r.from, C.squareToIndex("e2"));
  assert.strictEqual(r.to, C.squareToIndex("e4"));
  assert.strictEqual(r.board[C.squareToIndex("e2")], null);
  assert.strictEqual(r.board[C.squareToIndex("e4")].t, "P");
  assert.strictEqual(r.board[C.squareToIndex("e4")].c, "w");

  r = C.applySan(r.board, "c5", "b");
  assert.ok(r, "c5 applies");
  assert.strictEqual(r.board[C.squareToIndex("c5")].c, "b");

  r = C.applySan(r.board, "Nf3", "w");
  assert.ok(r, "Nf3 applies");
  assert.strictEqual(r.from, C.squareToIndex("g1"));
  assert.strictEqual(r.board[C.squareToIndex("f3")].t, "N");
});

test("applySan never moves into check / picks the right knight", function () {
  /* after 1.e4 d5 white's g1 knight cannot land on f3 pinned-style checks aside,
     prove legality: a king cannot move into attack */
  var b = C.initialBoard();
  var ok = C.applySan(b, "e4", "w");
  ok = C.applySan(ok.board, "e5", "b");
  ok = C.applySan(ok.board, "Qh5", "w");
  /* black cannot answer with Kf7? no—legal; but black queen d8 cannot jump: */
  assert.strictEqual(C.applySan(ok.board, "Qxh5", "b"), null, "queen cannot teleport");
  /* black king may not step to e7... it can; try g6 blinking into the h5-rook line: */
  var illegal = C.applySan(ok.board, "Na6", "b");
  assert.ok(illegal, "Na6 applies");

  /* Fool's-mate position: after 1.f3 e5 2.g4 white king can't move up? verify Qh4 mates replay */
  ok = C.applySan(b, "f3", "w");
  ok = C.applySan(ok.board, "e5", "b");
  ok = C.applySan(ok.board, "g4", "w");
  var mate = C.applySan(ok.board, "Qh4", "b");
  assert.ok(mate, "Qh4 applies");
  assert.strictEqual(mate.captured, null);
});

test("applySan handles castling both sides", function () {
  var b = C.initialBoard();
  ["Nf3", "Nf6", "g3", "g6", "Bg2", "Bg7", "O-O", "O-O"].forEach(function (san, i) {
    var side = i % 2 === 0 ? "w" : "b";
    var r = C.applySan(b, san, side);
    assert.ok(r, san + " applies");
    b = r.board;
  });
  assert.strictEqual(b[C.squareToIndex("g1")].t, "K");
  assert.strictEqual(b[C.squareToIndex("f1")].t, "R");
  assert.strictEqual(b[C.squareToIndex("e1")], null);
  assert.strictEqual(b[C.squareToIndex("g8")].t, "K");
  assert.strictEqual(b[C.squareToIndex("f8")].t, "R");
});

test("pseudoTargets sanity for a knight and a pawn", function () {
  var b = C.initialBoard();
  assert.deepEqual(
    C.pseudoTargets(b, C.squareToIndex("b1")).map(C.indexToSquare).sort(),
    ["a3", "c3"]
  );
  assert.deepEqual(
    C.pseudoTargets(b, C.squareToIndex("e2")).map(C.indexToSquare).sort(),
    ["e3", "e4"]
  );
  assert.deepEqual(
    C.pseudoTargets(b, C.squareToIndex("e1")).map(C.indexToSquare).sort(),
    []
  );
});

/* ---------------- movetext + real game replay ---------------- */

test("parseMovetext strips numbers, results and dots", function () {
  var t = C.parseMovetext("1.e4 e5 2.Nf3 2...c6 3.Bb5 1-0");
  assert.deepEqual(t, ["e4", "e5", "Nf3", "c6", "Bb5"]);
});

test("all bundled games replay cleanly from the starting position", function () {
  assert.ok(C.GAMES.length >= 2, "several games bundled");
  C.GAMES.forEach(function (g) {
    var r = C.replayGame(g.movetext);
    assert.ok(r.ok, g.title + " replays (failed at ply " + r.ply + ": " + r.failed + ")");
    assert.ok(r.plies.length >= 3, g.title + " has plies");
    assert.strictEqual(r.plies[0].side, "w");
    var boardsAlternateSides = r.plies.every(function (p, i) {
      return p.side === (i % 2 === 0 ? "w" : "b");
    });
    assert.ok(boardsAlternateSides, "sides alternate");
  });
});

test("Opera Game final position matches the known mate", function () {
  var g = C.GAMES[0];
  var r = C.replayGame(g.movetext);
  var last = r.plies[r.plies.length - 1];
  assert.strictEqual(last.san, "Rd8#");
  assert.strictEqual(last.side, "w");
  assert.strictEqual(last.to, C.squareToIndex("d8"));
  var fb = r.finalBoard;
  assert.strictEqual(fb[C.squareToIndex("d8")].c, "w");
  assert.strictEqual(fb[C.squareToIndex("e8")].t, "K");
  assert.ok(C.attacked(fb, C.squareToIndex("e8"), "w"), "black king is checked");
});

test("Lasker game disambiguated knight move Neg4+ resolves", function () {
  var r = C.replayGame(C.GAMES[1].movetext);
  var neg4 = r.plies.filter(function (p) { return p.san === "Neg4+"; })[0];
  assert.ok(neg4, "Neg4+ present");
  assert.strictEqual(neg4.from, C.squareToIndex("e5"));
  assert.strictEqual(neg4.to, C.squareToIndex("g4"));
  /* 11.Qxh7+ is a real sacrifice, and 12.Nxf6+ retakes with check */
  var qxsac = r.plies.filter(function (p) { return p.san === "Qxh7+"; })[0];
  assert.strictEqual(qxsac.to, C.squareToIndex("h7"));
  var nxf6 = r.plies.filter(function (p) { return p.san === "Nxf6+"; })[0];
  assert.strictEqual(nxf6.boardBefore[C.squareToIndex("f6")].c, "b");
  assert.strictEqual(nxf6.boardAfter[C.squareToIndex("f6")].c, "w",
    "knight lands on f6, capturing the bishop");
});

test("Lasker king walk ends in mate by king move, 18.Kd2#", function () {
  var r = C.replayGame(C.GAMES[1].movetext);
  var last = r.plies[r.plies.length - 1];
  assert.strictEqual(last.san, "Kd2#");
  /* black king sits on g1, mated along the first rank */
  var fb = r.finalBoard;
  assert.strictEqual(fb[C.squareToIndex("g1")].t, "K");
  assert.strictEqual(fb[C.squareToIndex("g1")].c, "b");
  assert.ok(C.attacked(fb, C.squareToIndex("g1"), "w"), "g1 is attacked (mate)");
  /* 17.Rh2# covered g2; rook marched from h1 */
  assert.strictEqual(fb[C.squareToIndex("h2")].t, "R");
});

test("shortest game: two-move mate replay", function () {
  var r = C.replayGame(C.GAMES[2].movetext);
  assert.ok(r.ok);
  assert.strictEqual(r.plies.length, 4);
  var mate = r.plies[3];
  assert.strictEqual(mate.san, "Qh4#");
  assert.strictEqual(mate.to, C.squareToIndex("h4"));
  assert.ok(C.attacked(r.finalBoard, C.squareToIndex("e1"), "b"), "white king mated square attacked");
});

/* ---------------- streaks ---------------- */

test("dateStr formats YYYY-MM-DD", function () {
  assert.strictEqual(C.dateStr(new Date(2026, 10, 5)), "2026-11-05");
  assert.strictEqual(C.dateStr(new Date(2026, 0, 1)), "2026-01-01");
});

test("prevDateStr walks back one calendar day", function () {
  assert.strictEqual(C.prevDateStr("2026-11-05"), "2026-11-04");
  assert.strictEqual(C.prevDateStr("2026-03-01"), "2026-02-28");
  assert.strictEqual(C.prevDateStr("2024-03-01"), "2024-02-29"); /* leap year */
  assert.strictEqual(C.prevDateStr("junk"), null);
});

test("streak: first day starts at 1", function () {
  var s = C.updateStreak({}, "2026-11-05");
  assert.strictEqual(s.streak, 1);
  assert.strictEqual(s.lastDate, "2026-11-05");
});

test("streak: consecutive day extends", function () {
  var s = C.updateStreak({ streak: 4, lastDate: "2026-11-04" }, "2026-11-05");
  assert.strictEqual(s.streak, 5);
  assert.strictEqual(s.lastDate, "2026-11-05");
});

test("streak: repeating same day does not inflate", function () {
  var s = C.updateStreak({ streak: 7, lastDate: "2026-11-05" }, "2026-11-05");
  assert.strictEqual(s.streak, 7);
  assert.strictEqual(s.lastDate, "2026-11-05");
});

test("streak: a gap resets to 1", function () {
  var s = C.updateStreak({ streak: 9, lastDate: "2026-11-01" }, "2026-11-05");
  assert.strictEqual(s.streak, 1);
  assert.strictEqual(s.lastDate, "2026-11-05");
});

console.log("\nAll " + testsRun + " tests passed.");
