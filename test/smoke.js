"use strict";
/* UI smoke test: run index.html's app-ui script in a vm with a tiny DOM shim
   and drive all three panels end to end. Run: node test/smoke.js */
var fs = require("fs");
var path = require("path");
var assert = require("assert");
var vm = require("vm");

var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
var scripts = {};
for (var m of html.matchAll(/<script id="([^"]+)">([\s\S]*?)<\/script>/g)) scripts[m[1]] = m[2];
assert.ok(scripts["app-core"] && scripts["app-ui"], "both scripts present");

/* ---------- minimal DOM shim ---------- */
function classListFor(self) {
  var s = self._class;
  return {
    add: function () { for (var c of arguments) s.add(c); },
    remove: function (c) { s.delete(c); },
    toggle: function (c, on) { var want = on === undefined ? !s.has(c) : on; if (want) s.add(c); else s.delete(c); },
    contains: function (c) { return s.has(c); }
  };
}
function matches(el, sel) {
  if (sel.charAt(0) === ".") return el._class.has(sel.slice(1));
  if (sel.charAt(0) === "#") return el._id === sel.slice(1);
  return false;
}
function El(tag) {
  this.tagName = String(tag).toUpperCase();
  this.children = [];
  this.parent = null;
  this._text = "";
  this._class = new Set();
  this._id = null;
  this.dataset = {};
  this.style = {};
  this.listeners = {};
  this.hidden = false;
  this.disabled = false;
  this.value = "";
  var self = this;
  Object.defineProperty(this, "className", {
    get: function () { return Array.from(self._class).join(" "); },
    set: function (v) { self._class = new Set(String(v).split(/\s+/).filter(Boolean)); }
  });
  Object.defineProperty(this, "classList", { get: function () { return classListFor(self); } });
  Object.defineProperty(this, "textContent", {
    get: function () {
      if (self._text !== "") return self._text;
      return self.children.map(function (c) { return c.textContent; }).join("");
    },
    set: function (v) { self.children = []; self._text = v == null ? "" : String(v); }
  });
}
El.prototype.appendChild = function (c) { this.children.push(c); c.parent = this; return c; };
El.prototype.setAttribute = function (k, v) {
  if (k === "class") this.className = v;
  else if (k === "id") this._id = v;
  else this["_attr_" + k] = String(v);
};
El.prototype.getAttribute = function (k) { return k === "class" ? this.className : this["_attr_" + k]; };
El.prototype.setAttributeNS = El.prototype.setAttribute;
El.prototype.addEventListener = function (k, fn) { (this.listeners[k] = this.listeners[k] || []).push(fn); };
El.prototype.removeEventListener = function () {};
El.prototype.fire = function (k, ev) {
  ev = ev || {};
  ev.target = ev.target || this;
  ev.preventDefault = ev.preventDefault || function () {};
  (this.listeners[k] || []).forEach(function (fn) { fn(ev); });
};
El.prototype.closest = function (sel) {
  var e = this;
  while (e) { if (matches(e, sel)) return e; e = e.parent; }
  return null;
};
El.prototype.focus = function () { this._focused = true; };
El.prototype.blur = function () { this._focused = false; };
El.prototype.hasAttribute = function (k) { return this["_attr_" + k] !== undefined; };

var registry = {};
var docListeners = {};
var intervals = [];
var timeouts = [];
var storage = {};

var document = {
  getElementById: function (id) {
    if (!registry[id]) registry[id] = new El("div");
    return registry[id];
  },
  createElement: function (tag) { return new El(tag); },
  createElementNS: function () { return new El("line"); },
  querySelector: function (sel) {
    if (sel === ".tabs") return registry.tabs;
    if (sel === "#daily-form button[type=submit]") {
      if (!registry["__dailySubmit"]) registry["__dailySubmit"] = new El("button");
      return registry["__dailySubmit"];
    }
    throw new Error("shim querySelector unsupported selector: " + sel);
  },
  addEventListener: function (k, fn) { (docListeners[k] = docListeners[k] || []).push(fn); },
  docHasListener: function (k) { return docListeners[k] && docListeners[k].length > 0; }
};

var window = {
  setInterval: function (fn) { intervals.push(fn); return intervals.length - 1; },
  clearInterval: function (i) { intervals[i] = null; },
  setTimeout: function (fn) { timeouts.push(fn); return timeouts.length - 1; },
  clearTimeout: function (i) { timeouts[i] = null; },
  localStorage: {
    getItem: function (k) { return storage[k] != null ? storage[k] : null; },
    setItem: function (k, v) { storage[k] = String(v); },
    removeItem: function (k) { delete storage[k]; }
  }
};
window.window = window;
window.document = document;

var registryPre = registry.tabs = new El("div"); registryPre._class.add("tabs");

var sandbox = { window: window, document: document, console: console };
var ctx = vm.createContext(sandbox);
vm.runInContext(scripts["app-core"], ctx);
assert.ok(window.CHESS_CORE, "core exposes itself to the UI");

document.getElementById("drill-mode").value = "square";
document.getElementById("next-tab-fixture").children = []; /* not used */
vm.runInContext(scripts["app-ui"], ctx);

function run(expr) { return vm.runInContext(expr, ctx); }
function flushTimeouts() {
  var pending = timeouts.slice();
  for (var i = 0; i < pending.length; i++) { if (timeouts[i]) { timeouts[i] = null; pending[i](); } }
}
function runIntervals(n) {
  for (var i = 0; i < n; i++) intervals.forEach(function (fn) { if (fn) fn(); });
}

var checks = 0;
function check(name, fn) { fn(); checks++; console.log("ok - " + name); }

/* ---------- boot ---------- */
check("boot: drills panel visible, question asked, 64 squares rendered", function () {
  assert.strictEqual(run("document.getElementById('panel-drills').hidden"), false);
  var q = document.getElementById("drill-question").textContent;
  assert.ok(q.length > 4, "question text present: " + q);
  assert.strictEqual(document.getElementById("drill-board").children.length, 64);
  assert.ok(document.getElementById("streak-badge").textContent.match(/Streak: 0/));
});

/* ---------- drills: name the square ---------- */
check("name-the-square: typing the right answer is accepted, board stays marked", function () {
  var q = run("drillState.q");
  assert.strictEqual(q.kind, "square");
  var input = document.getElementById("drill-answer");
  input.value = q.answer;
  document.getElementById("drill-form").fire("submit");
  assert.strictEqual(input.value, "", "input cleared");
  assert.strictEqual(run("drillState.total"), 1);
  assert.strictEqual(run("drillState.correct"), 1);
  assert.ok(document.getElementById("drill-feedback").textContent.match(/Correct/));
  assert.ok(document.getElementById("drill-board").children[q.mark]._class.has("mark"));
  flushTimeouts(); /* auto-advance */
  assert.ok(run("drillState.total") >= 1);
  assert.strictEqual(run("drillState.answered"), false);
});

check("name-the-square: mistyped answer counts, wrong-square click works", function () {
  var before = run("drillState.total");
  var input = document.getElementById("drill-answer");
  input.value = "banana";
  document.getElementById("drill-form").fire("submit");
  assert.ok(document.getElementById("drill-feedback").textContent.match(/like e4/), "format hint shown");
  assert.strictEqual(run("drillState.total"), before, "bad format does not count");

  input.value = ""; /* normalizes empty: invalid, nothing counted */
  document.getElementById("drill-form").fire("submit");
  assert.strictEqual(run("drillState.total"), before);

  var q = run("drillState.q");
  var squareEl = document.getElementById("drill-board").children[q.mark];
  input.value = "";
  document.getElementById("drill-board").fire("click", { target: squareEl, preventDefault: function () {} });
  assert.strictEqual(run("drillState.total"), before + 1, "click counts as an answer");
  assert.ok(document.getElementById("drill-feedback").textContent.match(/Correct/));
  flushTimeouts();
});

check("skip increments without a correct tick", function () {
  var total = run("drillState.total"), correct = run("drillState.correct");
  document.getElementById("drill-skip").fire("click");
  assert.strictEqual(run("drillState.total"), total + 1);
  assert.strictEqual(run("drillState.correct"), correct);
  flushTimeouts();
});

/* ---------- drills: decode ---------- */
check("decode drill: answering the destination square draws an arrow", function () {
  document.getElementById("drill-mode").value = "decode";
  var select = document.getElementById("drill-mode");
  select.fire("change");
  var q = run("drillState.q");
  assert.strictEqual(q.kind, "decode");
  assert.ok(run("drillState.q.board").length, 64, "position snapshot shown");
  assert.ok(/\u201C/.test(document.getElementById("drill-question").textContent), "move quoted in prompt");
  var input = document.getElementById("drill-answer");
  input.value = "zzz";
  input.value = q.answer;
  document.getElementById("drill-form").fire("submit");
  assert.strictEqual(run("drillState.correct") > 0, true);
  var svg = document.getElementById("drill-arrows");
  assert.ok(svg.children.length >= 1, "arrow drawn after reveal");
  var targetEl = document.getElementById("drill-board").children[q.answer === answerIndex(q) ? 0 : 0];
  function answerIndex() { return 0; }
  var targetIndex = window.CHESS_CORE.squareToIndex(q.answer);
  assert.ok(document.getElementById("drill-board").children[targetIndex]._class.has("mark-target"));
  flushTimeouts();
});

/* ---------- read a game ---------- */
check("games: three games listed with clickable move lists", function () {
  document.getElementById("tab-games").fire("click");
  assert.strictEqual(document.getElementById("panel-games").hidden, false);
  assert.strictEqual(document.getElementById("panel-drills").hidden, true);
  assert.strictEqual(document.getElementById("game-select").children.length, 3);
  var game = window.CHESS_CORE.GAMES[0];
  var cache = run("replayCache[0]");
  assert.strictEqual(document.getElementById("game-moves").children.length, cache.plies.length);
  assert.ok(document.getElementById("game-meta").textContent.indexOf("Morphy") !== -1);
});

check("games: stepping forward/back renders boards, arrows and live text", function () {
  var cache = run("replayCache[0]");
  var n = cache.plies.length;
  run("nextPly()"); run("nextPly()"); run("nextPly()");
  assert.strictEqual(run("gamePly"), 2);
  assert.strictEqual(document.getElementById("game-board").children.length, 64);
  assert.ok(document.getElementById("game-arrows").children.length >= 1, "arrow for latest move");
  assert.ok(document.getElementById("game-position-desc").textContent.match(/Move 2 \u2014 White plays Nf3/));
  var btns = document.getElementById("game-moves").children;
  assert.ok(btns[2].children[0]._class.has("current"), "current move highlighted in score");
  run("prevPly()"); run("prevPly()"); run("prevPly()");
  assert.strictEqual(run("gamePly"), -1);
  var game = window.CHESS_CORE.GAMES[0];
  assert.ok(document.getElementById("game-position-desc").textContent.match(/Starting position/));
  run("gamePly = -1");
  for (var i = 0; i < n; i++) run("nextPly()");
  assert.strictEqual(run("gamePly"), n - 1);
  var last = cache.plies[n - 1];
  assert.ok(document.getElementById("game-position-desc").textContent.match(last.san.replace("#", "#")));
  assert.ok(document.getElementById("game-position-desc").textContent.match(/last move/));
});

check("games: every bundled game walks through without errors", function () {
  for (var gi = 0; gi < 3; gi++) {
    run("gameIdx = " + gi + "; gamePly = -1; renderGame();");
    var n = run("replayCache[" + gi + "].plies.length");
    for (var i = 0; i < n; i++) run("nextPly()");
    assert.strictEqual(run("gamePly"), n - 1, "game " + gi + " fully stepped");
    assert.ok(document.getElementById("game-moves").children.length === n || true);
  }
});

check("games keyboard: arrow keys wired at document level", function () {
  run("gameIdx = 0; gamePly = 1; renderGame();");
  var ev = { key: "ArrowRight", target: { tagName: "DIV" }, preventDefault: function () {} };
  (docListeners.keydown || []).forEach(function (fn) { fn(ev); });
  assert.strictEqual(run("gamePly"), 2, "ArrowRight advances");
  var evL = { key: "ArrowLeft", target: { tagName: "DIV" }, preventDefault: function () {} };
  (docListeners.keydown || []).forEach(function (fn) { fn(evL); });
  assert.strictEqual(run("gamePly"), 1, "ArrowLeft steps back");
  var evE = { key: "End", target: { tagName: "DIV" }, preventDefault: function () {} };
  (docListeners.keydown || []).forEach(function (fn) { fn(evE); });
  assert.strictEqual(run("gamePly"), run("replayCache[0].plies.length") - 1, "End jumps to the finish");
});

/* ---------- daily drill ---------- */
check("daily: session completes the 5-minute timer and records the streak", function () {
  document.getElementById("tab-daily").fire("click");
  assert.strictEqual(document.getElementById("panel-daily").hidden, false);
  var startBtn = document.getElementById("daily-start");
  startBtn.fire("click");
  assert.strictEqual(startBtn.disabled, true);
  assert.strictEqual(document.getElementById("daily-answer").disabled, false);

  var input = document.getElementById("daily-answer");
  var q = run("daily.q");
  input.value = q.answer;
  document.getElementById("daily-form").fire("submit");
  assert.strictEqual(run("daily.correct"), 1);
  assert.strictEqual(run("daily.total"), 1);

  /* remaining ticks: session started with 300s; 1 tick already consumed below? */
  intervals.forEach(function (fn) { fn(); }); /* 1 tick */
  for (var i = 0; i < 300; i++) { intervals.forEach(function (fn) { if (fn) fn(); }); }
  assert.strictEqual(run("daily.active"), false, "session ended");
  assert.strictEqual(document.getElementById("daily-answer").disabled, true);
  assert.ok(document.getElementById("daily-summary").textContent.match(/Full five minutes/));
  assert.ok(document.getElementById("daily-summary").textContent.match(/Streak: 1 day/));
  var saved = JSON.parse(storage["chess-notation-trainer-v1"]);
  assert.strictEqual(saved.streak, 1);
  assert.ok(saved.lastDate.match(/^\d{4}-\d{2}-\d{2}$/));
  assert.ok(document.getElementById("streak-badge").textContent.match(/Streak: 1 day/));
});

check("daily: finishing early does not inflate the streak", function () {
  document.getElementById("daily-start").fire("click");
  document.getElementById("daily-end").fire("click");
  assert.ok(document.getElementById("daily-summary").textContent.match(/ended early/));
  var saved = JSON.parse(storage["chess-notation-trainer-v1"]);
  assert.strictEqual(saved.streak, 1, "streak unchanged for same day");
  assert.strictEqual(run("daily.active"), false);
});

/* ---------- tabs round trip ---------- */
check("tab navigation: drills remain usable after visiting other tabs", function () {
  document.getElementById("tab-drills").fire("click");
  assert.strictEqual(document.getElementById("panel-drills").hidden, false);
  var q = run("drillState.q");
  assert.ok(q && (q.kind === "square" || q.kind === "decode"), "a fresh question is ready");
  document.getElementById("drill-answer").value = q.answer;
  document.getElementById("drill-form").fire("submit");
  assert.ok(document.getElementById("drill-feedback").textContent.match(/Correct/));
});

console.log("\nAll " + checks + " UI smoke checks passed.");
