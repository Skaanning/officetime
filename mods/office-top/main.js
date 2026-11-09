// The office, seen from above, filling the whole window. Each herdr space is a team with a
// desk group of its own; every local agent has a desk in its team's group.
// Working: typing. Blocked: a red "!" (and a HELP! alarm after five minutes). Done: a green
// check and confetti until you look. Idle: they get up and run around: coffee, the water
// cooler, ping pong, the arcade, the windows, the couch (after ten idle minutes, a nap now and then).
// Agents on other machines join from the meeting room. An idle agent whose sub-agents are still
// running stays in its chair. New agents come in the front door; closed ones leave. A dog lives here.
// Hover anyone for details; click them to go to their terminal in the workspace.
import { View, div } from "gpui-kit";
import { agents, terminals, spaces, shared, run, setAgentOrder } from "herdr";

// Where clicking an agent, the Back button and the toggle key return to.
const WORKSPACE = "main";
// Fills the office with pretend agents, to see every state without running real ones.
const DEMO = 0;

const COLS = 44, ROWS = 25; // the floor plan, in tiles
const C = 11; // the corridor everyone walks along
const SPEED = 3.4; // tiles per second
const DOG_SPEED = 2.4;
const DOG_NAME = "Waffles";
// What the dog is up to, by where it is (hover it to see), and what it says now and then.
const DOG_DOING = {
  dogbed1: ["Napping in the lounge bed", "Dreaming of squirrels", "Snoring softly by the TV"],
  dogbed2: ["Guarding the front door (asleep)", "Napping by the door", "Waiting for the mail carrier"],
  dogkitchen: ["Begging by the kitchen table", "Hoping someone drops a sandwich", "Doing the sad eyes for snacks"],
  board1: ["Supervising the whiteboard", "Reviewing the architecture diagram"],
  window2: ["Watching birds out the window", "Woofing at a pigeon"],
  pingR: ["Waiting for someone to drop the ball", "Guarding the ping pong table"],
  bean3: ["Lounging on a beanbag", "Hogging the beanbag"],
  stroll: ["Patrolling the hallway", "Sniffing around the hallway", "Woofing at the printer"],
};
const DOG_SAYS = ["woof!", "woof woof!", "*wags tail*", "arf!", "*sniff sniff*", "bork!"];
const DOG_MOOD = ["Very good dog", "Would like a treat", "Tail status: wagging", "Has been a good dog all day", "Accepts belly rubs"];
// The day: 0 follows the real clock; a number of minutes runs a whole day that fast (try 10).
const DAY_LENGTH = 0;
const PERSON = 1.55; // how big people are, against a tile
const NAP_AFTER = 10 * 60 * 1000;
const NAP_CHANCE = 0.3; // once tired, how often a new stay is a nap (never two in a row)
const ALARM_AFTER = 5 * 60 * 1000;
const STAY = [45000, 120000]; // how long an idle agent stays somewhere before moving on

const STATUS = { working: "#4c8bf5", blocked: "#ef5350", done: "#4caf7a", idle: "#9aa3ad" };
// The sidebar's space colors, by stored name (as mods/spaces draws them).
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const SKINS = ["#ffdbc2", "#f0bf98", "#d79e70", "#b07a4f", "#7d5233", "#5a3a22"];
const HAIRS = ["#1f1611", "#4a2c1a", "#7a4a26", "#d8a637", "#9c3a22", "#2b2d36", "#5d6fd8", "#c46ba0"];
const SHIRTS = ["#ef8354", "#4c8bf5", "#4caf7a", "#8e6bd8", "#f2c14e", "#e9698f", "#3bb7b0", "#6c7a89", "#d65a5a"];
// Mug colors by program (anything else gets a plain cream mug).
const MUGS = { claude: "#cc785c", codex: "#f1f1f1", gemini: "#5b8def", cursor: "#333438", opencode: "#4fb07a", amp: "#a07ad6", aider: "#e5b84b" };
const CONFETTI = ["#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0", "#b388ff", "#ff8fab"];
// What idle agents say now and then, wherever they hang out: half the time a line about the spot they're at.
const BABBLE = [
  "my context is full", "you're absolutely right", "compacting…", "87% confident", "hallucinated a lib",
  "rate limited 😴", "let me re-read that", "tokens are tight", "tool call failed", "I'll just grep it",
  "it's always DNS", "off by one. again.", "git blame says me", "it was the cache", "now I have 2 regexes",
  "null is a lie", "heisenbug 👻", "works in prod only", "who wrote this? oh.",
];
const SPOT_BABBLE = {
  coffee: ["brewing a hotfix", "Java ☕ lol", "caffeine.js loaded", "espresso-driven dev"],
  fridge: ["who ate my cache?", "cold storage", "expired: 2019", "LRU evicted my lunch"],
  cooler: ["heard prod is down?", "who pushed to main?", "hydrating the DOM", "standup ran 40 min"],
  ktable: ["lunch && learn", "sandwich.yaml", "eating my own dogfood", "byte-sized snack"],
  ping: ["ping… pong… ACK", "packet loss!", "200 OK", "TTL expired"],
  arcade: ["speedrunning CI", "insert token", "high score: 0 bugs", "1UP: one more retry"],
  window: ["the cloud is real", "touching grass.exe", "outside: 404", "sun.js is laggy"],
  bean: ["thinking in O(1)", "await vibes()", "blocking on nothing", "low-power mode"],
  couch: ["horizontal scaling", "idle by design", "cold start pending"],
  board: ["boxes and arrows", "this is the arch", "it's microservices now", "draw.io was down"],
  printer: ["PC LOAD LETTER?!", "printf debugging", "paper jam in prod"],
};
const CODE = ["#8be9c7", "#ffc978", "#a5b4ff", "#ff9ec7"];
// Desk finishes ([edge, top]) and the things people keep on them (null: nothing there).
const FINISHES = [["#7a5c40", "#a3825e"], ["#5a3f2c", "#7d5a3f"], ["#9aa0a8", "#e2e5e9"], ["#5f636c", "#82878f"], ["#8a6a4a", "#c49a6c"], ["#3f4a5a", "#56657a"]];
const DAY = 86400000;
const DESK_THINGS = ["plant", "lamp", "books", "papers", "notes", "headphones", "duck", "photo", "pens", "succulent", null, null, "papers", "notes"];

// ── The floor plan ────────────────────────────────────────────────────────────────────
// Left: meeting room over the game room. Right: kitchen over the lounge. Middle: the open
// office, with the corridor (y = C) running across, and the front door at its left end.
// Every spot is a place someone can be, with the path (`via`) from it out to the corridor;
// a walk goes out along one spot's path, along the corridor, and in along the other's, so
// nobody walks through furniture or walls.

// Desk groups: one per space. A seat: [x, y, face, via, desk]; a desk: [x, y, w, h] with the
// monitor on the side away from the seat, or "laptop" for the round table.
const D = (x, y, w, h) => ({ x, y, w, h });
const GROUPS = [
  { // A pod of four.
    sign: [14.2, 8.3],
    seats: [
      [13.1, 2.2, "down", [[11.3, 2.2], [11.3, C]], D(12, 3, 2.2, 1.4)],
      [15.3, 2.2, "down", [[17.2, 2.2], [17.2, C]], D(14.2, 3, 2.2, 1.4)],
      [13.1, 6.6, "up", [[11.3, 6.6], [11.3, C]], D(12, 4.4, 2.2, 1.4)],
      [15.3, 6.6, "up", [[17.2, 6.6], [17.2, C]], D(14.2, 4.4, 2.2, 1.4)],
    ],
  },
  { // A bench of three along the windows.
    sign: [22.5, 4.3],
    seats: [
      [20.3, 2.8, "up", [[20.3, C]], D(19.2, 0.6, 2.2, 1.4)],
      [22.5, 2.8, "up", [[22.5, C]], D(21.4, 0.6, 2.2, 1.4)],
      [24.7, 2.8, "up", [[24.7, C]], D(23.6, 0.6, 2.2, 1.4)],
    ],
  },
  { // Two pairs facing each other across the desks.
    sign: [30.4, 7.6],
    seats: [
      [28.2, 3.1, "right", [[27.4, 3.1], [27.4, C]], D(29, 2, 1.4, 2.2)],
      [28.2, 5.3, "right", [[27.4, 5.3], [27.4, C]], D(29, 4.2, 1.4, 2.2)],
      [32.6, 3.1, "left", [[33.4, 3.1], [33.4, C]], D(30.4, 2, 1.4, 2.2)],
      [32.6, 5.3, "left", [[33.4, 5.3], [33.4, C]], D(30.4, 4.2, 1.4, 2.2)],
    ],
  },
  { // A big pod of six.
    sign: [15.3, 20.6],
    seats: [
      [13.1, 13.6, "down", [[13.1, C]], D(12, 14.4, 2.2, 1.4)],
      [15.3, 13.6, "down", [[15.3, C]], D(14.2, 14.4, 2.2, 1.4)],
      [17.5, 13.6, "down", [[17.5, C]], D(16.4, 14.4, 2.2, 1.4)],
      [13.1, 18, "up", [[13.1, 19.2], [11.3, 19.2], [11.3, C]], D(12, 15.8, 2.2, 1.4)],
      [15.3, 18, "up", [[15.3, 19.2], [11.3, 19.2], [11.3, C]], D(14.2, 15.8, 2.2, 1.4)],
      [17.5, 18, "up", [[17.5, 19.2], [19.5, 19.2], [19.5, C]], D(16.4, 15.8, 2.2, 1.4)],
    ],
  },
  { // A round table, laptops out.
    sign: [24, 20.8],
    table: [24, 16.5, 3],
    seats: [
      [24, 14.5, "down", [[24, C]], "laptop"],
      [21.9, 16.5, "right", [[21.9, C]], "laptop"],
      [26.1, 16.5, "left", [[26.1, C]], "laptop"],
      [24, 18.5, "up", [[24, 19.8], [21.4, 19.8], [21.4, C]], "laptop"],
    ],
  },
  { // A bench of three, backed by a bookshelf.
    sign: [30.3, 16.6],
    seats: [
      [28.5, 13.4, "down", [[28.5, C]], D(27.6, 14.2, 1.8, 1.4)],
      [30.3, 13.4, "down", [[30.3, C]], D(29.4, 14.2, 1.8, 1.4)],
      [32.1, 13.4, "down", [[32.1, C]], D(31.2, 14.2, 1.8, 1.4)],
    ],
  },
  { // Another pod of four, tucked in the corner.
    sign: [30.4, 24],
    seats: [
      [29.3, 18.2, "down", [[27, 18.2], [27, C]], D(28.2, 19, 2.2, 1.4)],
      [31.5, 18.2, "down", [[33.4, 18.2], [33.4, C]], D(30.4, 19, 2.2, 1.4)],
      [29.3, 22.6, "up", [[27, 22.6], [27, C]], D(28.2, 20.4, 2.2, 1.4)],
      [31.5, 22.6, "up", [[33.4, 22.6], [33.4, C]], D(30.4, 20.4, 2.2, 1.4)],
    ],
  },
];

const SPOTS = {};
const SEATS = []; // every desk seat: { id, group, ... }
GROUPS.forEach((g, gi) => g.seats.forEach(([x, y, face, via, desk]) => {
  const id = `desk:${SEATS.length}`;
  const s = { id, x, y, face, pose: "sit", via, desk, group: gi };
  SEATS.push(s);
  SPOTS[id] = s;
}));
const spot = (o) => { SPOTS[o.id] = { pose: "stand", ...o }; };
spot({ id: "door", x: 0.9, y: C, face: "right", via: [] });
// Kitchen (door at x 36.5).
spot({ id: "coffee", x: 36, y: 2.3, face: "up", via: [[36.5, 2.3], [36.5, C]] });
spot({ id: "fridge", x: 41.6, y: 4, face: "right", via: [[41.6, 8.6], [36.5, 8.6], [36.5, C]] });
spot({ id: "ktable1", x: 37.6, y: 6, face: "right", pose: "sit", via: [[36.5, 6], [36.5, C]] });
spot({ id: "ktable2", x: 40.4, y: 6, face: "left", pose: "sit", via: [[40.4, 8.6], [36.5, 8.6], [36.5, C]] });
spot({ id: "cooler1", x: 35.9, y: 7.6, face: "left", via: [[36.5, 7.6], [36.5, C]] });
spot({ id: "cooler2", x: 35.4, y: 6.4, face: "down", via: [[36.5, 6.4], [36.5, C]] });
// Lounge (door at x 36.5).
const lounge = (x, y) => [[40.4, y], [40.4, 13.2], [36.5, 13.2], [36.5, C]];
spot({ id: "couch1", x: 41.7, y: 15.9, face: "left", pose: "sit", via: lounge(41.7, 15.9) });
spot({ id: "couch2", x: 41.7, y: 17.7, face: "left", pose: "sit", via: lounge(41.7, 17.7) });
spot({ id: "couch3", x: 41.7, y: 19.5, face: "left", pose: "sit", via: lounge(41.7, 19.5) });
spot({ id: "bean1", x: 36.2, y: 22.6, face: "up", pose: "sit", via: [[36.5, 22.6], [36.5, C]] });
spot({ id: "bean2", x: 39, y: 22.8, face: "up", pose: "sit", via: [[39, 21.2], [36.5, 21.2], [36.5, C]] });
spot({ id: "bean5", x: 41.6, y: 22.8, face: "up", pose: "sit", via: [[40.4, 22.8], ...lounge(0, 22.8).slice(1)] });
// Game room (door at x 8.6).
const game = (x, y) => [[x, 13.2], [8.6, 13.2], [8.6, C]];
spot({ id: "pingL", x: 1.9, y: 17.8, face: "right", via: game(1.9) });
spot({ id: "pingR", x: 8.6, y: 17.8, face: "left", via: [[8.6, C]] });
spot({ id: "arcade1", x: 2, y: 21.2, face: "left", via: game(2) });
spot({ id: "arcade2", x: 2, y: 23.2, face: "left", via: game(2) });
spot({ id: "bean3", x: 5, y: 23, face: "up", pose: "sit", via: [[5, 21], [8.6, 21], [8.6, C]] });
spot({ id: "bean4", x: 7.2, y: 23, face: "up", pose: "sit", via: [[7.2, 21], [8.6, 21], [8.6, C]] });
// The open office.
spot({ id: "window1", x: 11.3, y: 1.2, face: "up", via: [[11.3, C]] });
spot({ id: "window2", x: 17.2, y: 1.2, face: "up", via: [[17.2, C]] });
spot({ id: "window3", x: 27.4, y: 1.2, face: "up", via: [[27.4, C]] });
spot({ id: "board1", x: 19.6, y: 15.4, face: "right", via: [[19.5, C]] });
spot({ id: "board2", x: 14.5, y: 22.9, face: "down", via: [[14.5, 19.2], [11.3, 19.2], [11.3, C]] });
spot({ id: "board3", x: 17.4, y: 4.6, face: "right", via: [[17.2, 4.6], [17.2, C]] });
spot({ id: "printer", x: 24, y: 23, face: "down", via: [[24, 21.6], [21.4, 21.6], [21.4, C]] });
for (let i = 0; i < 7; i++) spot({ id: `stroll${i}`, x: 3 + i * 6, y: C, face: "down", via: [] });
// The dog's beds (one in the lounge, one by the front door) and its begging spot in the kitchen.
spot({ id: "dogbed1", x: 35.9, y: 20.6, face: "right", via: [[36.5, 20.6], [36.5, C]] });
spot({ id: "dogbed2", x: 3.4, y: 10.55, face: "right", via: [[3.4, C]] });
spot({ id: "dogkitchen", x: 38.6, y: 8.6, face: "up", via: [[36.5, 8.6], [36.5, C]] });

// What idle agents do, with how often they pick it.
const HANGOUTS = [
  ["coffee", 2], ["fridge", 1], ["cooler1", 3], ["cooler2", 3], ["ktable1", 2], ["ktable2", 2],
  ["pingL", 3], ["pingR", 3], ["arcade1", 2], ["arcade2", 2], ["bean3", 1], ["bean4", 1],
  ["bean1", 1], ["bean2", 1], ["bean5", 1], ["couch1", 1], ["couch2", 1], ["couch3", 1],
  ["window1", 1], ["window2", 1], ["window3", 1], ["board1", 1], ["board2", 1], ["board3", 1], ["printer", 1],
  ...Array.from({ length: 7 }, (_, i) => [`stroll${i}`, 1]),
];
const NAP_SPOTS = ["couch1", "couch2", "couch3", "bean1", "bean2", "bean5", "bean3", "bean4"];
const DOG_SPOTS = ["dogbed1", "dogbed2", "dogbed1", "dogkitchen", "stroll1", "stroll3", "stroll5", "board1", "window2", "pingR", "bean3"];
const MEETING = [[3.5, 2.6, "down"], [5.5, 2.6, "down"], [7.5, 2.6, "down"], [3.5, 7.4, "up"], [5.5, 7.4, "up"], [7.5, 7.4, "up"]];

// Windows in the top and bottom walls: [x, y, length, vertical]. The side walls are thinner (SIDE).
const WINDOWS = [
  [0.8, 0, 2.3, false], [7.9, 0, 2.3, false], [11.2, 0, 4.6, false], [16.7, 0, 4.6, false], [22.2, 0, 4.6, false],
  [27.7, 0, 4.6, false], [34.9, 0, 3.8, false], [39.3, 0, 3.8, false],
  [1.2, 24.5, 7.8, false], [17, 24.5, 5.6, false], [25.6, 24.5, 6.8, false], [35, 24.5, 7.8, false],
];
// The light through the day, by hour: sky color in the windows, how dark the room gets, and
// a warm tint at dawn and dusk.
const SKY = [[0, "#101833"], [4.5, "#18234a"], [5.8, "#e9a58a"], [7, "#a9daf5"], [16.5, "#a9daf5"], [18.3, "#f2a06b"], [19.6, "#4a3e7a"], [21, "#101833"], [24, "#101833"]];
const SIDE = 0.25;
const DARK = [[0, 0.34], [5, 0.34], [7, 0], [17.5, 0], [20.5, 0.34], [24, 0.34]];
const WARM = [[0, 0], [5, 0], [6.2, 0.13], [7.5, 0], [17, 0], [18.6, 0.14], [20, 0], [24, 0]];

// Walls: [x1, y1, x2, y2], glass or not. Gaps are the doors.
const WALLS = [
  [10.5, 0.5, 10.5, 9.8, true], [SIDE, 9.8, 4.5, 9.8, true], [6.5, 9.8, 10.5, 9.8, true],
  [SIDE, 12.2, 7.6, 12.2], [9.6, 12.2, 10.5, 12.2], [10.5, 12.2, 10.5, 24.5],
  [34, 0.5, 34, 9.8], [34, 9.8, 35.6, 9.8], [37.4, 9.8, 44 - SIDE, 9.8],
  [34, 12.2, 35.6, 12.2], [37.4, 12.2, 44 - SIDE, 12.2], [34, 12.2, 34, 24.5],
];

const chain = (s) => [[s.x, s.y], ...s.via];
// The path from where a walker is heading (a point on spot `from`'s path) to spot `to`.
function route(label, to) {
  const from = SPOTS[label.spot];
  const pts = [];
  if (from && from.id === to.id) {
    chain(to).slice(0, label.k).reverse().forEach(([x, y], j, arr) => pts.push({ x, y, label: { spot: to.id, k: arr.length - 1 - j } }));
    return pts;
  }
  if (from) chain(from).slice(label.k + 1).forEach(([x, y], j) => pts.push({ x, y, label: { spot: from.id, k: label.k + 1 + j } }));
  const into = chain(to);
  for (let j = into.length - 1; j >= 0; j--) pts.push({ x: into[j][0], y: into[j][1], label: { spot: to.id, k: j } });
  return pts;
}

// ── Helpers ───────────────────────────────────────────────────────────────────────────
// A steady number for a string (an address, a desk), to pick looks and decor from.
function hash(str) {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 12)) >>> 0;
}
// How someone looks: skin, hair (most short, some a ponytail or a bun, a few bald) and shirt.
function look(address) {
  const h = hash(address);
  const from = (list, step) => list[Math.floor(h / step) % list.length];
  const shirt = from(SHIRTS, 1);
  const style = h % 23 === 5 ? "bald" : from(["short", "short", "ponytail", "short", "bun", "short", "ponytail", "short"], 97);
  return { skin: from(SKINS, 7), hair: from(HAIRS, 53), style, shirt, sleeve: shade(shirt, 0.82), salt: h };
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, "0");
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}
function mugOf(a) {
  const who = `${a.program?.key ?? ""} ${a.app ?? ""}`.toLowerCase();
  for (const k in MUGS) if (who.includes(k)) return MUGS[k];
  return "#efe9df";
}
const remote = (address) => address.includes("/");
// Live sub-agents (started with hc run) under terminal `addr`, at any depth.
function subAgents(all, addr) {
  const found = [], todo = [addr];
  while (todo.length) {
    const p = todo.pop();
    for (const t of all) if (t.parent === p && t.state === "live") { found.push(t); todo.push(t.address); }
  }
  return found;
}
const clock = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
function at24(keys, h, mix) {
  for (let i = 1; i < keys.length; i++) if (h <= keys[i][0]) {
    const [h0, a] = keys[i - 1], [h1, b] = keys[i];
    return mix(a, b, (h - h0) / (h1 - h0 || 1));
  }
  return keys[keys.length - 1][1];
}
const lerp = (a, b, t) => a + (b - a) * t;
function lerpColor(a, b, t) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, "0")).join("");
}
const ago = (ms) => ms < 60000 ? "just now" : ms < 3600000 ? `${Math.floor(ms / 60000)} min` : `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min`;
// December and the first days of January get a tree in the lounge.
const season = (d) => (d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() < 3) ? "winter" : null);
function spaceColor(id) {
  const c = (shared("space.colors") ?? {})[id] ?? (id.startsWith("demo-") ? Object.keys(MARK)[hash(id) % 6] : "ansi6");
  return c.startsWith("#") ? c : MARK[c] ?? MARK.ansi6;
}
const FACE = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export default class OfficeTop extends View {
  init(_props, cx) {
    this.size = { width: 1600, height: 900 };
    this.desk = load("officeTop.desk2", {}); // address -> seat index
    this.team = load("officeTop.team", {}); // space id -> group index
    this.w = {}; // walker key -> where it is and where it's going
    this.hang = {}; // idle address -> { spot, until, nap }
    this.seen = {};
    this.idleSince = {};
    this.blockedSince = {};
    this.leaving = {}; // address -> look, for agents walking out
    this.hovered = null;
    this.started = false;
    this.dog = { spot: "dogbed1", until: Date.now() + 20000 };
    this.born = Date.now();
    this.now = this.clock();
    // The light changes slowly: a redraw every 30 s on the real clock, or ~240 a day when fast.
    cx.timer.every(DAY_LENGTH ? Math.max(1000, (DAY_LENGTH * 60000) / 240) : 30000, (cx) => { this.now = this.clock(); cx.notify(); });
    // Idle agents move on when their stay is up (data, not animation: a few seconds apart).
    cx.timer.every(2500, (cx) => {
      const now = Date.now();
      if (Object.values(this.hang).some((h) => now >= h.until) || now >= this.dog.until) cx.notify();
    });
  }

  // The office's time: the real one, or a fast day starting at this hour.
  clock() {
    if (!DAY_LENGTH) return new Date();
    const start = new Date(this.born);
    const day = ((Date.now() - this.born) / (DAY_LENGTH * 60000)) * DAY;
    return new Date(start.getTime() + day);
  }

  // Each space gets a desk group of its own (the smallest free one that fits it), and its
  // agents sit there. A space bigger than its group spills into a free group, then anywhere.
  seat(list) {
    const live = new Set(list.map((a) => a.address));
    const bySpace = {};
    for (const a of list) (bySpace[a.space] ??= []).push(a);
    let changed = false;
    for (const k of Object.keys(this.desk)) if (!live.has(k)) { delete this.desk[k]; changed = true; }
    for (const k of Object.keys(this.hang)) if (!live.has(k)) delete this.hang[k];
    for (const s of Object.keys(this.team)) if (!bySpace[s]) { delete this.team[s]; changed = true; }
    const owned = new Set(Object.values(this.team));
    for (const [s, members] of Object.entries(bySpace)) {
      if (s in this.team) continue;
      const free = GROUPS.map((g, i) => ({ i, n: g.seats.length })).filter((g) => !owned.has(g.i));
      if (!free.length) continue;
      const fits = free.filter((g) => g.n >= members.length).sort((a, b) => a.n - b.n);
      const g = fits[0] ?? free.sort((a, b) => b.n - a.n)[0];
      this.team[s] = g.i;
      owned.add(g.i);
      changed = true;
    }
    const taken = new Set(Object.values(this.desk));
    const freeSeat = (pred) => SEATS.findIndex((s, i) => !taken.has(i) && pred(s));
    for (const a of list) {
      const home = this.team[a.space];
      const cur = this.desk[a.address];
      if (cur !== undefined && (SEATS[cur].group === home || freeSeat((s) => s.group === home) < 0)) continue;
      let i = home !== undefined ? freeSeat((s) => s.group === home) : -1;
      if (i < 0 && cur !== undefined) continue;
      if (i < 0) i = freeSeat((s) => !owned.has(s.group));
      if (i < 0) i = freeSeat(() => true);
      if (i < 0) continue; // a full office: they stand around the corridor
      if (cur !== undefined) taken.delete(cur);
      this.desk[a.address] = i;
      taken.add(i);
      changed = true;
    }
    if (changed) { save("officeTop.desk2", this.desk); save("officeTop.team", this.team); }
  }

  track(list, now) {
    const changed = {};
    for (const s of spaces()) for (const t of s.tabs ?? []) changed[t.id] = t.changed_at;
    for (const a of list) {
      if (a.status !== "idle") { delete this.idleSince[a.address]; delete this.hang[a.address]; }
      else this.idleSince[a.address] ??= changed[a.tab] ?? now;
      if (a.status !== "blocked") delete this.blockedSince[a.address];
      else this.blockedSince[a.address] ??= changed[a.tab] ?? now;
      this.seen[a.address] = look(a.address);
    }
  }

  // Where an idle agent goes next: somewhere free, weighted. A tired one (idle past NAP_AFTER)
  // now and then naps on a couch seat or a beanbag, but never twice in a row.
  hangout(a, now, taken) {
    const h = this.hang[a.address];
    if (h && now < h.until) return h.spot;
    const tired = now - (this.idleSince[a.address] ?? now) > NAP_AFTER;
    let pick = null;
    if (tired && !h?.nap && Math.random() < NAP_CHANCE) {
      const beds = NAP_SPOTS.filter((s) => !taken.has(s) && s !== h?.spot);
      pick = beds[Math.floor(Math.random() * beds.length)] ?? null;
    }
    const napping = pick !== null;
    if (!pick) {
      const free = HANGOUTS.filter(([s]) => !taken.has(s) && s !== h?.spot);
      let r = Math.random() * free.reduce((n, [, w]) => n + w, 0);
      for (const [s, w] of free) { if ((r -= w) <= 0) { pick = s; break; } }
      pick ??= `stroll${Math.floor(Math.random() * 7)}`;
    }
    const stay = napping ? 5 * 60000 : STAY[0] + Math.random() * (STAY[1] - STAY[0]);
    this.hang[a.address] = { spot: pick, until: now + stay, nap: napping };
    return pick;
  }

  // Moves walker `key` toward spot `want`, one straight leg at a time; the element's
  // native transition does the animating.
  step(key, want, speed, now, cx) {
    let w = this.w[key];
    if (!w) {
      const start = this.started && want.id !== "door" ? SPOTS.door : want;
      w = this.w[key] = { x: start.x, y: start.y, label: { spot: start.id, k: 0 }, route: [], legEnd: 0, dur: 1, goal: start.id, face: start.face, arrived: true };
      if (start !== want) { w.legEnd = now + 60; cx.timer.after(80, (cx) => cx.notify()); }
    }
    if (w.goal !== want.id) { w.goal = want.id; w.reroute = true; }
    if (now >= w.legEnd) {
      if (w.reroute) { w.route = route(w.label, want); w.reroute = false; }
      let next = w.route.shift();
      while (next && Math.hypot(next.x - w.x, next.y - w.y) < 0.01) { w.label = next.label; next = w.route.shift(); }
      if (next) {
        const dx = next.x - w.x, dy = next.y - w.y;
        w.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        w.dur = Math.max(120, (Math.hypot(dx, dy) / speed) * 1000);
        w.legEnd = now + w.dur;
        Object.assign(w, { x: next.x, y: next.y, label: next.label, arrived: false });
        cx.timer.after(w.dur + 15, (cx) => cx.notify());
      } else if (!w.arrived) {
        w.arrived = true;
        w.face = want.face;
      }
    }
    return w;
  }

  render(cx) {
    const { width: W, height: H } = this.size;
    const U = (this.U = Math.max(8, Math.min(W / COLS, H / ROWS)));
    this.ox = Math.round((W - COLS * U) / 2);
    this.oy = Math.round((H - ROWS * U) / 2);
    const now = Date.now();
    const list = DEMO ? demoAgents(DEMO, now) : agents();
    setAgentOrder(list.map((a) => a.address));
    const here = list.filter((a) => !remote(a.address));
    const away = list.filter((a) => remote(a.address));
    const all = terminals();
    this.seat(here);
    this.track(list, now);

    // Where everyone wants to be.
    // Working, blocked and done agents sit at their desks; so does an idle one whose sub-agents
    // are still running (it's waiting on them).
    const busy = (a) => a.status !== "idle" || subAgents(all, a.address).length > 0;
    const want = {};
    for (const a of here) if (busy(a) && a.address in this.desk) want[a.address] = `desk:${this.desk[a.address]}`;
    const taken = new Set(Object.values(want));
    for (const [k, h] of Object.entries(this.hang)) if (here.some((a) => a.address === k)) taken.add(h.spot);
    for (const a of here) {
      if (want[a.address]) continue;
      if (busy(a)) { want[a.address] = `stroll${hash(a.address) % 7}`; continue; }
      taken.delete(this.hang[a.address]?.spot);
      want[a.address] = this.hangout(a, now, taken);
      taken.add(want[a.address]);
    }
    // Closed agents walk out the door.
    const live = new Set(here.map((a) => a.address));
    for (const k of Object.keys(this.w)) {
      if (k === "dog" || live.has(k) || this.leaving[k]) continue;
      if (this.started && this.seen[k]) this.leaving[k] = this.seen[k];
      else delete this.w[k];
    }
    for (const k of Object.keys(this.leaving)) {
      const w = this.step(k, SPOTS.door, SPEED, now, cx);
      if (w.arrived && w.goal === "door") { delete this.leaving[k]; delete this.w[k]; }
    }

    // The cat naps on an empty chair now and then.
    const bySeat = {};
    for (const a of here) if (a.address in this.desk) bySeat[this.desk[a.address]] = a;
    if (now >= this.dog.until) {
      const opts = DOG_SPOTS.filter((s) => !taken.has(s) && s !== this.dog.spot);
      const pick = opts[Math.floor(Math.random() * opts.length)] ?? "dogbed1";
      this.dog = { spot: pick, until: now + (pick.startsWith("dogbed") ? 40000 : 12000) + Math.random() * 20000 };
    }

    const people = here.map((a) => ({ a, w: this.step(a.address, SPOTS[want[a.address]], SPEED, now, cx) }));
    const dog = this.step("dog", SPOTS[this.dog.spot], DOG_SPEED, now, cx);
    const at = (id) => people.find((p) => p.w.arrived && p.w.goal === id && p.a.status === "idle");
    const pong = at("pingL") && at("pingR");
    const teams = {}; // group index -> the space that sits there
    const names = {};
    for (const a of here) names[a.space] = a.space_name;
    for (const [s, g] of Object.entries(this.team)) teams[g] = { id: s, name: names[s] ?? "", color: spaceColor(s) };

    const hour = this.now.getHours() + this.now.getMinutes() / 60;
    const light = {
      sky: at24(SKY, hour, lerpColor), dark: at24(DARK, hour, lerp), warm: at24(WARM, hour, lerp),
      sun: Math.max(0, Math.sin((Math.PI * (hour - 6.5)) / 12)), hour,
    };
    const dark = light.dark > 0.15;
    this.light = light;
    const when = season(this.now);
    const hovered = list.find((a) => a.address === this.hovered);
    this.started = true;

    const sorted = [...people].sort((p, q) => p.w.y - q.w.y);
    return div().id("office-top").size_full().relative().overflow_hidden().bg("#1d2029")
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .children([
        ...this.floor(),
        ...this.rugs(),
        ...this.sunlight(light),
        ...this.rooms(dark, away.length, when),
        ...this.workspace(),
        ...GROUPS.flatMap((g, gi) => this.group(g, gi, teams[gi])),
        ...SEATS.map((s, i) => this.deskAt(s, bySeat[i], teams[s.group])),
        ...this.walls(),
        ...this.meeting(away),
        ...(pong ? this.pong() : []),
        this.doggy(dog),
        ...Object.entries(this.leaving).map(([k, pal]) => this.walker(`leave-${k}`, this.w[k], pal, { box: true })),
        ...sorted.map(({ a, w }) => this.agent(a, w)),
        ...this.ambient(light, bySeat),
        ...GROUPS.flatMap((g, gi) => teams[gi] ? [this.sign(g, teams[gi])] : []),
        ...sorted.flatMap(({ a, w }) => this.overhead(a, w, now)),
        this.hud(list),
        ...(list.length ? [] : [this.empty("Nobody's in yet. Start an agent and they'll walk in.")]),
        this.dogTag(dog, now),
        ...(hovered ? [this.card(hovered, now)] : []),
        ...(this.hovered === "dog" ? [this.dogCard(dog, now)] : []),
      ]);
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────────────
  // A rectangle in tiles.
  R(x, y, w, h, color, radius = 0) {
    const U = this.U;
    const el = div().absolute().left(this.ox + x * U).top(this.oy + y * U).w(w * U).h(h * U).bg(color);
    return radius ? el.rounded(radius * U) : el;
  }
  O(x, y, d, color) { return this.R(x - d / 2, y - d / 2, d, d, color, d / 2); }

  floor() {
    const R = this.R.bind(this);
    const els = [R(0, 0, COLS, ROWS, "#c8a77b")];
    // Wood planks in the open office.
    for (let y = 1; y < ROWS - 0.5; y += 1) els.push(R(10.5, y, 23.5, 0.04, "#b6946a"));
    for (let y = 0.5, i = 0; y < ROWS - 0.5; y++, i++)
      for (let x = 10.5 + (i % 2) * 2.5; x < 34; x += 5) els.push(R(x, y, 0.04, 1, "#b6946a"));
    // The corridor runner.
    els.push(R(SIDE, C - 1.2, COLS - 2 * SIDE, 2.4, "#b99a72"), R(0.5, C - 0.75, 43, 1.5, "#a8443f"), R(0.5, C - 0.62, 43, 1.24, "#b8524b"));
    // Kitchen tiles.
    els.push(R(34, 0.5, 10 - SIDE, 9.3, "#ebe5d8"));
    for (let y = 0; y < 9; y++) for (let x = 34 + (y % 2); x < COLS - SIDE; x += 2) els.push(R(x, 0.5 + y, Math.min(1, COLS - SIDE - x), Math.min(1, 9.3 - y), "#dcd3c2"));
    // Lounge carpet and rug; meeting room and game room carpets.
    els.push(R(34, 12.2, 10 - SIDE, 12.3, "#8a7a9e"));
    els.push(R(37, 14.8, 3.8, 5.6, "#c4875f", 0.5), R(37.25, 15.05, 3.3, 5.1, "#d89a6e", 0.4));
    els.push(R(SIDE, 0.5, 10.5 - SIDE, 9.3, "#6f8ea6"), R(SIDE, 12.2, 10.5 - SIDE, 12.3, "#6d9a72"));
    for (let x = 1.5; x < 10.5; x += 2) els.push(R(x, 12.2, 0.05, 12.3, "#64906a"));
    // Outer walls, windows along the top, the front door at the left end of the corridor.
    const wall = "#3a3f4c", top = "#4d5466";
    els.push(R(0, 0, COLS, 0.5, wall), R(0, ROWS - 0.5, COLS, 0.5, wall), R(COLS - SIDE, 0, SIDE, ROWS, wall));
    els.push(R(0, 0, SIDE, C - 1.1, wall), R(0, C + 1.1, SIDE, ROWS - C - 1.1, wall));
    els.push(R(0, 0.4, COLS, 0.1, top));
    els.push(...this.windows());
    els.push(R(0, C - 1.1, 0.12, 2.2, "#7a5c3e"), R(0.05, C - 0.6, SIDE + 0.05, 0.08, "#5b4430"), R(0.05, C + 0.52, SIDE + 0.05, 0.08, "#5b4430"));
    els.push(R(0.7, C - 0.6, 0.9, 1.2, "#5a4a3a", 0.1), R(0.8, C - 0.5, 0.7, 1, "#6d5a46", 0.08)); // doormat
    return els;
  }

  walls() {
    return WALLS.map(([x1, y1, x2, y2, glass]) => {
      const t = glass ? 0.16 : 0.26;
      const x = Math.min(x1, x2) - (x1 === x2 ? t / 2 : 0), y = Math.min(y1, y2) - (y1 === y2 ? t / 2 : 0);
      const w = x1 === x2 ? t : Math.abs(x2 - x1), h = y1 === y2 ? t : Math.abs(y2 - y1);
      return this.R(x, y, w, h, glass ? "#c9ecf8cc" : "#3a3f4c");
    });
  }

  rooms(dark, remoteCount, when) {
    const R = this.R.bind(this), O = this.O.bind(this);
    const els = [];
    // Meeting room: a long table, a screen for the video call.
    els.push(R(2.5, 3.5, 6, 3, "#6b4f3a", 0.25), R(2.65, 3.65, 5.7, 2.7, "#7d5d44", 0.2));
    for (const [x, y] of MEETING) els.push(O(x, y, 0.75, "#2f3542"));
    els.push(R(3.4, 0.55, 4.2, 0.5, "#1c1f26", 0.08), R(3.55, 0.62, 3.9, 0.34, remoteCount ? "#3a6fb0" : "#2a2f3a"));
    els.push(this.text(3.4, 1.05, 4.2, 0.5, remoteCount ? `📹 ${remoteCount} remote` : "MEETING", "#cfe3f5", 0.3));
    // Game room: ping pong, two arcades, beanbags, a bookshelf.
    els.push(R(2.7, 16.3, 5, 3, "#1f6f4a", 0.1), R(2.8, 16.4, 4.8, 2.8, "#2f8f5f", 0.08));
    els.push(R(5.17, 16.2, 0.06, 3.2, "#f4f4f4"), R(2.8, 17.77, 4.8, 0.04, "#d8f0e0"));
    for (const y of [21.2, 23.2]) els.push(R(0.6, y - 0.6, 1, 1.2, "#2a2440", 0.12), R(0.9, y - 0.45, 0.5, 0.9, "#53e0c8", 0.06));
    for (const [x, c] of [[5, "#d1495b"], [7.2, "#edae49"]]) els.push(O(x, 23.2, 1.5, shade(c, 0.85)), O(x, 23.3, 1.2, c));
    els.push(R(9.5, 14, 0.75, 4.5, "#6b4f3a"));
    for (let y = 14.15, i = 0; y < 18.3; y += 0.34, i++) els.push(R(9.58, y, 0.5, 0.24, CONFETTI[i % CONFETTI.length]));
    // Kitchen: counter with coffee machine and sink, fridge, round table, water cooler.
    els.push(R(34.3, 0.5, 9, 1.25, "#7a6a5a"), R(34.3, 0.5, 9, 1.1, "#cfc6b6"));
    els.push(R(35.4, 0.65, 1.2, 0.85, "#2b2b2f", 0.1), O(36, 1.08, 0.36, "#8a5a3a"));
    els.push(R(38.4, 0.65, 1.6, 0.8, "#9aa5ad", 0.15), O(39.2, 1.05, 0.45, "#c9d3d9"));
    els.push(R(42.2, 3, 1.25, 2, "#e8ecef", 0.1), R(42.25, 3.9, 1.15, 0.05, "#9aa5ad"));
    els.push(O(39, 6, 2.2, "#8a6a4a"), O(39, 6, 2, "#a3825e"), O(38.6, 5.7, 0.35, "#f4f1ea"), O(39.4, 6.4, 0.3, "#d97757"));
    els.push(O(37.6, 6, 0.75, "#2f3542"), O(40.4, 6, 0.75, "#2f3542"));
    els.push(O(34.8, 8.6, 0.9, "#cfe9f7"), O(34.8, 8.6, 0.55, "#5aa9e6"));
    // Lounge: couch along the wall, coffee table, a TV, beanbags.
    els.push(R(42.4, 15, 1.1, 5.4, "#3e5c9a", 0.2), R(41.3, 15, 1.2, 5.4, "#5374b8", 0.25));
    els.push(R(38.2, 16.2, 1.4, 2.6, "#6b4f3a", 0.15), O(38.9, 16.9, 0.35, "#f4f1ea"));
    els.push(R(34.25, 15.5, 0.45, 3.5, "#1c1f26", 0.08), R(34.6, 15.7, 0.08, 3.1, dark ? "#4a7ad8" : "#2a2f3a"));
    for (const [x, c] of [[36.2, "#58b368"], [39, "#9b6bdc"], [41.6, "#e07a5f"]]) els.push(O(x, 23.1, 1.4, shade(c, 0.85)), O(x, 23.2, 1.1, c));
    // The dog's beds.
    for (const [x, y] of [[35.9, 20.6], [3.4, 10.55]]) els.push(O(x, y, 1.45, "#7a4b8c"), O(x, y, 1.15, "#a27bb5"));
    // Plants by the doors and in the corners.
    for (const [x, y] of [[1.2, 13], [10, 9.2], [33.4, 9.2], [43, 9.2], [43, 12.9], [34.7, 23.9], [1.2, 9.2], [43, 23.9], [34.9, 13.1], [9.8, 23.8], [1.2, 1.2], [42.9, 2.4]]) els.push(...this.plant(x, y));
    if (when === "winter") els.push(O(42.6, 22, 2, "#2f7d4a"), O(42.6, 22, 1.4, "#3f9a5c"), O(42.6, 22, 0.4, "#f2c94c"));
    return els;
  }

  // Things between the desk groups: whiteboards, bookshelves, plants, a printer.
  workspace() {
    const R = this.R.bind(this), O = this.O.bind(this);
    const board = (x, y, w, h) => [R(x, y, w, h, "#8d939c", 0.04), R(x + 0.06, y + 0.06, w - 0.12, h - 0.12, "#f4f6f8", 0.03)];
    const scribble = (x, y, vertical) => [0, 1, 2].map((k) => vertical
      ? R(x, y + 0.5 + k * 1.3, 0.06, 0.9 - k * 0.2, ["#3d8be0", "#e05252", "#58b368"][k])
      : R(x + 0.4 + k * 1.2, y, 0.8 - k * 0.15, 0.06, ["#3d8be0", "#e05252", "#58b368"][k]));
    const shelf = (x, y, w, h) => {
      const els = [R(x, y, w, h, "#6b4f3a", 0.04)];
      const vertical = h > w;
      for (let k = 0, p = 0.12; p < (vertical ? h : w) - 0.3; k++, p += 0.32)
        els.push(vertical ? R(x + 0.08, y + p, w - 0.16, 0.22, CONFETTI[(k * 7) % 6]) : R(x + p, y + 0.08, 0.22, h - 0.16, CONFETTI[(k * 5) % 6]));
      return els;
    };
    return [
      // Between the pod and the window bench: a standing whiteboard.
      ...board(18, 1.6, 0.34, 6), ...scribble(18.14, 1.6, true),
      // Plants between the bench's chairs, and under it.
      ...this.plant(21.4, 6.4), ...this.plant(23.6, 6.4), ...this.plant(19.2, 8.4), ...this.plant(25.8, 8.4),
      // A bookshelf between the bench and the pairs.
      ...shelf(26.1, 1.2, 0.6, 5.6),
      ...this.plant(30.4, 8.6), ...this.plant(33.4, 1.2),
      // Lower office: a whiteboard between the big pod and the round table.
      ...board(20.3, 13.6, 0.34, 5), ...scribble(20.44, 13.6, true),
      // A bookshelf backing the bench of three, plants on top.
      ...shelf(27.6, 16.4, 5.4, 0.5), O(28.2, 16.65, 0.4, "#4fa95f"), O(32.4, 16.65, 0.4, "#4fa95f"),
      // By the bottom wall: a wall whiteboard, the printer, plants.
      ...board(12.6, 23.75, 3.8, 0.4), ...scribble(12.6, 23.92, false),
      R(23.3, 23.6, 1.4, 0.85, "#d9dde2", 0.1), R(23.5, 23.75, 1, 0.3, "#3a3f4c"),
      ...this.plant(11.2, 23.9), ...this.plant(19.6, 23.9), ...this.plant(26.4, 23.9), ...this.plant(33.4, 23.9),
      ...this.plant(19.6, 20.6),
    ];
  }

  // A potted plant: a bush, a palm, a flowering one, a snake plant, or a cactus.
  plant(x, y, kind = ["bush", "palm", "flower", "snake", "bush", "cactus", "palm", "flower"][hash(`${x},${y}`) % 8]) {
    const O = this.O.bind(this), R = this.R.bind(this);
    if (kind === "palm") {
      const els = [O(x, y, 0.7, "#b0673f"), O(x, y, 0.5, "#5a3a24")];
      for (const [dx, dy] of [[-0.42, -0.1], [0.4, -0.18], [-0.12, -0.45], [0.2, 0.38], [-0.32, 0.3], [0.44, 0.2]])
        els.push(O(x + dx * 0.8, y + dy * 0.8, 0.42, "#2f7d45"), O(x + dx * 0.5, y + dy * 0.5, 0.3, "#3f9a5c"));
      return [...els, O(x, y, 0.22, "#4fae68")];
    }
    if (kind === "flower") {
      const els = [O(x, y, 0.72, "#c9c2b8"), O(x, y, 0.62, "#3f8f4f"), O(x - 0.12, y - 0.1, 0.4, "#4fa95f")];
      for (const [dx, dy, c] of [[-0.18, -0.15, "#f06292"], [0.16, -0.08, "#ffd54f"], [0.02, 0.18, "#f06292"], [-0.2, 0.12, "#ffffff"], [0.2, 0.17, "#ba68c8"]])
        els.push(O(x + dx, y + dy, 0.13, c));
      return els;
    }
    if (kind === "snake") {
      const els = [R(x - 0.3, y - 0.3, 0.6, 0.6, "#3b3f4c", 0.1), R(x - 0.24, y - 0.24, 0.48, 0.48, "#5a3a24", 0.08)];
      for (const [dx, dy, w, h] of [[-0.16, -0.2, 0.1, 0.42], [0, -0.26, 0.1, 0.5], [0.14, -0.18, 0.1, 0.38], [-0.08, -0.02, 0.32, 0.08]])
        els.push(R(x + dx, y + dy, w, h, "#3d7a3a", 0.04), R(x + dx + 0.02, y + dy + 0.03, Math.max(0.04, w - 0.06), Math.max(0.04, h - 0.08), "#9bc46a", 0.03));
      return els;
    }
    if (kind === "cactus") {
      return [O(x, y, 0.56, "#c4683f"), O(x, y, 0.44, "#3f8a4a"), O(x, y, 0.3, "#55a35f"),
        O(x - 0.08, y - 0.06, 0.05, "#e8f0d0"), O(x + 0.09, y + 0.04, 0.05, "#e8f0d0"), O(x - 0.02, y + 0.1, 0.05, "#e8f0d0"), O(x + 0.11, y - 0.1, 0.1, "#f06292")];
    }
    return [O(x, y, 0.8, "#8a5a3a"), O(x - 0.15, y - 0.1, 0.55, "#3f8f4f"), O(x + 0.18, y + 0.05, 0.5, "#4fa95f"), O(x, y - 0.25, 0.45, "#5cbc6c")];
  }

  // Rugs on the floor, under the furniture.
  rugs() {
    const R = this.R.bind(this), O = this.O.bind(this);
    const els = [];
    // A round rug under the round table.
    els.push(O(24, 16.5, 5.2, "#2f5d73"), O(24, 16.5, 4.8, "#3f7a94"), O(24, 16.5, 3.8, "#e8d9b5"), O(24, 16.5, 3.5, "#3f7a94"));
    // A striped runner under the plants below the window bench.
    els.push(R(19.6, 5.5, 5.8, 3.4, "#c96f4a", 0.15));
    for (let k = 0; k < 5; k++) els.push(R(19.9, 5.85 + k * 0.62, 5.2, 0.22, k % 2 ? "#f0c27a" : "#f4e6cc", 0.05));
    // A shaggy rug under the game room's beanbags.
    els.push(R(3.6, 21.7, 5, 2.6, "#6a4c93", 0.3), R(3.8, 21.9, 4.6, 2.2, "#7d5ca8", 0.25));
    for (let k = 0; k < 6; k++) els.push(O(4.3 + k * 0.72, 23, 0.3, "#9277c2"));
    // A patterned rug under the meeting table.
    els.push(R(1.8, 2.9, 7.4, 4.2, "#8c3b3b", 0.1), R(2.05, 3.15, 6.9, 3.7, "#b5584a", 0.08), R(2.4, 3.5, 6.2, 3, "#8c3b3b", 0.06));
    // A soft square under the kitchen table.
    els.push(R(37.2, 4.2, 3.6, 3.6, "#7aa38a", 0.2), R(37.45, 4.45, 3.1, 3.1, "#93bba2", 0.16));
    return els;
  }

  text(x, y, w, h, s, color, size) {
    return this.R(x, y, w, h, "#00000000").flex().items_center().justify_center().text_size(Math.max(9, size * this.U)).text_color(color).child(s);
  }

  // A group's own furniture (the round table), and a rug in the team's color when taken.
  group(g, gi, team) {
    const els = [];
    if (team) {
      const box = g.seats.flatMap(([x, y, , , d]) => [[x - 0.7, y - 0.7], [x + 0.7, y + 0.7], ...(d === "laptop" ? [] : [[d.x - 0.2, d.y - 0.2], [d.x + d.w + 0.2, d.y + d.h + 0.2]])]);
      if (g.table) box.push([g.table[0] - g.table[2] / 2, g.table[1] - g.table[2] / 2], [g.table[0] + g.table[2] / 2, g.table[1] + g.table[2] / 2]);
      const xs = box.map((p) => p[0]), ys = box.map((p) => p[1]);
      const x0 = Math.max(0.6, Math.min(...xs)), y0 = Math.max(0.55, Math.min(...ys)), x1 = Math.max(...xs), y1 = Math.max(...ys);
      els.push(this.R(x0, y0, x1 - x0, y1 - y0, team.color + "59", 0.4).border(Math.max(2, 0.07 * this.U)).border_color(shade(team.color, 0.7) + "cc"));
    }
    if (g.table) {
      const [x, y, d] = g.table;
      els.push(this.O(x, y, d, "#7a5c40"), this.O(x, y, d - 0.15, "#a3825e"));
    }
    return els;
  }

  // A desk (or a laptop at the round table) with its chair; the screen glows in its agent's
  // status. Chairs take the team's color.
  deskAt(s, a, team) {
    const R = this.R.bind(this), O = this.O.bind(this);
    const [fx, fy] = FACE[s.face];
    const chair = team ? shade(team.color, 0.55) : "#2f3542";
    const els = [O(s.x - fx * 0.15, s.y - fy * 0.15, 0.82, chair)];
    const st = a?.status;
    const glow = STATUS[st] ?? STATUS.idle;
    if (s.desk === "laptop") {
      const lx = s.x + fx * 0.95, ly = s.y + fy * 0.95;
      const side = fx !== 0;
      els.push(R(lx - (side ? 0.22 : 0.35), ly - (side ? 0.35 : 0.22), side ? 0.44 : 0.7, side ? 0.7 : 0.44, a ? "#c9ced6" : "#b9bec6", 0.05));
      if (a) els.push(R(lx - (side ? 0.12 : 0.28) + fx * 0.12, ly - (side ? 0.28 : 0.12) + fy * 0.12, side ? 0.1 : 0.56, side ? 0.56 : 0.1, glow, 0.03));
      return div().children(els);
    }
    const d = s.desk;
    const seed = hash(s.id);
    const [edge, surface] = FINISHES[seed % FINISHES.length];
    els.push(R(d.x + 0.05, d.y + 0.05, d.w - 0.1, d.h - 0.1, edge, 0.08), R(d.x + 0.12, d.y + 0.11, d.w - 0.24, d.h - 0.22, surface, 0.06));
    // Monitor on the far edge, keyboard on the near one.
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    const far = { x: cx + fx * (d.w / 2 - 0.3), y: cy + fy * (d.h / 2 - 0.3) };
    const near = { x: cx - fx * (d.w / 2 - 0.35), y: cy - fy * (d.h / 2 - 0.35) };
    const side = fx !== 0;
    const mw = side ? 0.22 : 1.3, mh = side ? 1.3 : 0.22;
    if ((seed >>> 4) % 4 === 0) { // two monitors
      const ax = side ? 0 : 0.36, ay = side ? 0.36 : 0;
      for (const k of [-1, 1]) els.push(R(far.x + k * ax - (side ? 0.11 : 0.34), far.y + k * ay - (side ? 0.34 : 0.11), side ? 0.22 : 0.68, side ? 0.68 : 0.22, "#23252e", 0.05));
    } else els.push(R(far.x - mw / 2, far.y - mh / 2, mw, mh, (seed >>> 4) % 4 === 1 ? "#d9dce1" : "#23252e", 0.05));
    // Things on the desk, in the far corners and the near corner the mug leaves free.
    const along = (side ? d.h : d.w) / 2 - 0.3;
    const mugSide = a ? (hash(a.address) % 2 ? 1 : -1) : 1;
    const slots = [
      side ? { x: far.x, y: cy - along } : { x: cx - along, y: far.y },
      side ? { x: far.x, y: cy + along } : { x: cx + along, y: far.y },
      side ? { x: near.x, y: cy - mugSide * 0.75 } : { x: cx - mugSide * 0.8, y: near.y },
    ];
    slots.forEach((p, k) => {
      const item = DESK_THINGS[((seed >>> (8 + k * 5)) >>> 0) % DESK_THINGS.length];
      if (item) els.push(...this.thing(item, p.x, p.y, seed + k));
    });
    els.push(R(near.x - (side ? 0.12 : 0.45), near.y - (side ? 0.45 : 0.12), side ? 0.24 : 0.9, side ? 0.9 : 0.24, a ? "#dcdde3" : "#c8c9cf", 0.04));
    if (a) {
      const gx = far.x - fx * 0.27, gy = far.y - fy * 0.27;
      els.push(R(gx - (side ? 0.15 : 0.6), gy - (side ? 0.6 : 0.15), side ? 0.3 : 1.2, side ? 1.2 : 0.3, glow + "55", 0.05));
      if (st === "working" && !side)
        for (let k = 0; k < 3; k++) els.push(R(gx - 0.52, gy - 0.12 + k * 0.08, 0.2, 0.04, CODE[k])
          .loop("width", { from: 0.15 * this.U, to: (0.55 + 0.15 * k) * this.U, period: 700 + k * 260, easing: "linear" }));
      if (st === "working" && side)
        for (let k = 0; k < 3; k++) els.push(R(gx - 0.12 + k * 0.08, gy - 0.52, 0.04, 0.2, CODE[k])
          .loop("height", { from: 0.15 * this.U, to: (0.55 + 0.15 * k) * this.U, period: 700 + k * 260, easing: "linear" }));
      const mug = side ? { x: near.x, y: near.y + (hash(a.address) % 2 ? 0.75 : -0.75) } : { x: near.x + (hash(a.address) % 2 ? 0.8 : -0.8), y: near.y };
      els.push(O(mug.x, mug.y, 0.28, mugOf(a)));
      if (st === "done")
        for (let k = 0; k < 10; k++) {
          const r = (a.seq * 31 + k * 97) >>> 0, x0 = d.x + 0.2 + ((r % 23) / 23) * (d.w - 0.4);
          els.push(R(x0, d.y, 0.12, 0.12, CONFETTI[k % CONFETTI.length])
            .loop("top", { from: this.oy + (d.y - 0.6) * this.U, to: this.oy + (d.y + d.h + 0.4) * this.U, period: 1100 + (r % 700), easing: "linear" })
            .loop("left", { from: this.ox + (x0 - 0.15) * this.U, to: this.ox + (x0 + 0.15) * this.U, period: 500 + (r % 300) }));
        }
    }
    return div().children(els);
  }

  // A small thing on a desk, centred on (x, y).
  thing(kind, x, y, seed) {
    const R = this.R.bind(this), O = this.O.bind(this);
    switch (kind) {
      case "plant": return [O(x, y, 0.34, "#c4683f"), O(x - 0.04, y - 0.03, 0.26, "#3f8f4f"), O(x + 0.05, y + 0.04, 0.2, "#5cbc6c")];
      case "succulent": return [O(x, y, 0.26, "#d9d4c8"), O(x, y, 0.18, "#6fb38a"), O(x, y, 0.08, "#9fd4b0")];
      case "lamp": return [O(x, y, 0.3, "#2f3542"), O(x, y, 0.18, "#ffd27a")];
      case "books": return [R(x - 0.2, y - 0.14, 0.4, 0.28, "#3d8be0", 0.03), R(x - 0.16, y - 0.18, 0.34, 0.26, "#e05252", 0.03), R(x - 0.12, y - 0.1, 0.28, 0.2, "#e0b43d", 0.03)];
      case "papers": return [R(x - 0.17, y - 0.2, 0.32, 0.4, "#e9e6df", 0.02), R(x - 0.13, y - 0.17, 0.32, 0.4, "#ffffff", 0.02), R(x - 0.07, y - 0.1, 0.18, 0.03, "#9aa0aa"), R(x - 0.07, y - 0.03, 0.2, 0.03, "#9aa0aa")];
      case "notes": return [R(x - 0.2, y - 0.08, 0.16, 0.16, "#ffe066", 0.02), R(x - 0.02, y - 0.14, 0.16, 0.16, "#ff8fab", 0.02), R(x + 0.02, y + 0.04, 0.16, 0.16, "#8ce99a", 0.02)];
      case "headphones": return [O(x - 0.12, y, 0.16, "#2a2a33"), O(x + 0.12, y, 0.16, "#2a2a33"), R(x - 0.12, y - 0.12, 0.24, 0.05, "#2a2a33", 0.02)];
      case "duck": return [O(x, y, 0.2, "#ffd43b"), O(x + 0.06, y - 0.06, 0.12, "#ffe066"), O(x + 0.12, y - 0.06, 0.05, "#f08c00")];
      case "photo": return [R(x - 0.13, y - 0.16, 0.26, 0.32, "#3a3f4c", 0.02), R(x - 0.09, y - 0.12, 0.18, 0.24, ["#9fd6f2", "#f4b98a", "#b9e4c9"][seed % 3], 0.01)];
      case "pens": return [O(x, y, 0.2, "#8d939c"), O(x - 0.04, y - 0.03, 0.06, "#e05252"), O(x + 0.04, y, 0.06, "#3d8be0"), O(x, y + 0.05, 0.06, "#2a2a33")];
      default: return [];
    }
  }

  // The team's name on the floor by its group.
  sign(g, team) {
    const U = this.U;
    const [x, y] = g.sign;
    return div().absolute().left(this.ox + (x - 3) * U).top(this.oy + (y - 0.3) * U).w(6 * U).h(0.6 * U).flex().items_center().justify_center()
      .child(div().flex().items_center().gap(Math.max(3, 0.1 * U)).px(Math.max(6, 0.18 * U)).h(0.56 * U).rounded(0.28 * U).bg(shade(team.color, 0.45) + "e6")
        .text_size(Math.max(11, 0.33 * U)).font_semibold().text_color("#ffffff")
        .child(div().w(0.2 * U).h(0.2 * U).rounded(0.1 * U).bg(team.color))
        .child(div().truncate().max_w(5 * U).child(team.name || "team")));
  }

  // A person seen from above, in a one-tile box centred on (w.x, w.y).
  body(pal, face, pose, opts = {}) {
    const U = this.U * PERSON, c = this.U / 2;
    const [fx, fy] = FACE[face] ?? FACE.down;
    const side = fx !== 0;
    const els = [div().absolute().left(c - 0.42 * U).top(c - 0.2 * U).w(0.84 * U).h(0.6 * U).rounded(0.3 * U).bg("#00000030")];
    const at = (x, y, w, h, color, r) => div().absolute().left(c + x * U - (w * U) / 2).top(c + y * U - (h * U) / 2).w(w * U).h(h * U).rounded(r * U).bg(color);
    if (pose === "lie") {
      els.push(at(0, 0.45, 0.38, 0.6, "#2f3b55", 0.15), at(0, 0.02, 0.44, 0.62, pal.shirt, 0.2), at(0, -0.42, 0.44, 0.44, pal.style === "bald" ? pal.skin : pal.hair, 0.22), at(-0.12, -0.42, 0.18, 0.26, pal.skin, 0.09));
      return els;
    }
    if (opts.walking) {
      const lx = side ? 0 : 0.14, ly = side ? 0.14 : 0;
      for (const [sgn, per] of [[1, 0], [-1, 1]]) {
        const foot = at(lx * sgn + fx * 0.18, ly * sgn + fy * 0.18, side ? 0.22 : 0.14, side ? 0.14 : 0.22, "#2a2a33", 0.05);
        const prop = side ? "left" : "top";
        const base = side ? c + (lx * sgn + fx * 0.18) * U - 0.11 * U : c + (ly * sgn + fy * 0.18) * U - 0.11 * U;
        const swing = 0.16 * U;
        els.push(foot.loop(prop, per ? { from: base + swing, to: base - swing, period: 360 } : { from: base - swing, to: base + swing, period: 360 }));
      }
    }
    els.push(at(0, 0, side ? 0.42 : 0.8, side ? 0.8 : 0.42, pal.shirt, 0.2));
    if (opts.typing || opts.box || opts.handUp) {
      for (const sgn of [1, -1]) {
        const ax = side ? fx * 0.3 : 0.3 * sgn, ay = side ? 0.3 * sgn : fy * 0.3;
        const arm = at(ax, ay, side ? 0.3 : 0.13, side ? 0.13 : 0.3, pal.sleeve, 0.06);
        if (opts.typing) {
          const prop = side ? "left" : "top";
          const base = side ? c + ax * U - 0.15 * U : c + ay * U - 0.15 * U;
          els.push(arm.loop(prop, { from: base, to: base + (side ? fx : fy) * 0.06 * U, period: sgn > 0 ? 230 : 290 }));
        } else els.push(arm);
      }
    }
    if (opts.box) els.push(at(fx * 0.42, fy * 0.42, 0.55, 0.45, "#c49a62", 0.04));
    if (opts.handUp) els.push(at(0.38, -0.38, 0.14, 0.14, pal.skin, 0.07).loop("top", { from: c - 0.52 * U, to: c - 0.38 * U, period: 420 }));
    // The head: hair on the crown, the face a sliver toward where they look.
    const bald = pal.style === "bald";
    if (pal.style === "ponytail") els.push(at(-fx * 0.3, -fy * 0.3, side ? 0.24 : 0.16, side ? 0.16 : 0.24, shade(pal.hair, 0.85), 0.08));
    // A skin disc with the hair disc set back over it: the face is the crescent left showing
    // at the front, and the hair has some volume at the back.
    els.push(at(fx * 0.06, fy * 0.06, 0.46, 0.46, pal.skin, 0.23));
    if (!bald) els.push(at(-fx * 0.05, -fy * 0.05, 0.48, 0.48, pal.hair, 0.24));
    if (pal.style === "bun") els.push(at(-fx * 0.14, -fy * 0.14, 0.22, 0.22, shade(pal.hair, 0.8), 0.11));
    if (bald) els.push(at(-fx * 0.12, -fy * 0.12, side ? 0.12 : 0.4, side ? 0.4 : 0.12, shade(pal.hair, 0.9), 0.06));
    return els;
  }

  moving(id, w) {
    const U = this.U;
    return div().id(id).absolute().left(this.ox + (w.x - 0.5) * U).top(this.oy + (w.y - 0.5) * U).w(U).h(U)
      .transition("left", { duration: Math.max(1, w.dur), easing: "linear" }).transition("top", { duration: Math.max(1, w.dur), easing: "linear" });
  }

  walker(id, w, pal, opts = {}) {
    return this.moving(id, w).children(this.body(pal, w.face, "stand", { walking: !w.arrived, ...opts }));
  }

  hover(id) {
    return (on, cx) => { this.hovered = on ? id : this.hovered === id ? null : this.hovered; cx.notify(); };
  }

  agent(a, w) {
    const U = this.U;
    const pal = this.seen[a.address] ?? look(a.address);
    const walking = !w.arrived;
    const s = SPOTS[w.goal];
    const atDesk = !walking && w.goal.startsWith("desk:");
    const pose = walking ? "stand" : s?.pose ?? "stand"; // nappers sit as everyone does, with a "z z" over them
    const opts = { walking, typing: atDesk && a.status === "working", handUp: atDesk && a.status === "blocked" };
    const ring = atDesk && (a.status === "blocked" || a.status === "done")
      ? [div().absolute().left(-0.3 * U).top(-0.3 * U).w(1.6 * U).h(1.6 * U).rounded(0.8 * U).border(Math.max(2, 0.06 * U)).border_color(STATUS[a.status])
        .loop("opacity", { from: 0.25, to: 1, period: a.status === "blocked" ? 600 : 1200 })]
      : [];
    return this.moving(`a-${a.address}`, w).cursor_pointer()
      .on_hover(this.hover(a.address)).on_click(() => this.goTo(a))
      .children([...ring, ...this.body(pal, w.face, pose, opts)]);
  }

  // Bubbles and labels, drawn above everyone (and above the night).
  overhead(a, w, now) {
    const U = this.U;
    const atDesk = w.arrived && w.goal.startsWith("desk:");
    const els = [];
    const bubble = (text, bg, fg = "#fff", wide = 2.8) => div().absolute().left(0.5 * U - wide / 2 * U).w(wide * U).top(-1.05 * U).flex().justify_center()
      .child(div().px(Math.max(4, 0.14 * U)).py(1).rounded(0.2 * U).bg(bg).text_color(fg).text_size(Math.max(10, 0.3 * U)).font_semibold().child(text));
    if (atDesk && a.status === "blocked") {
      const long = now - (this.blockedSince[a.address] ?? now) > ALARM_AFTER;
      els.push(bubble(long ? "HELP!!" : "!", "#e05252").loop("opacity", { from: 0.45, to: 1, period: long ? 400 : 700 }));
    } else if (atDesk && a.status === "done") {
      els.push(bubble("✓ done", "#3f9a54"));
    } else if (atDesk && a.status === "working") {
      els.push(div().absolute().left(0.5 * U - 1.2 * U).w(2.4 * U).top(-1.0 * U).flex().justify_center()
        .child(div().px(Math.max(3, 0.1 * U)).rounded(0.2 * U).bg("#ffffffd0").text_color("#3a3f4c").text_size(Math.max(10, 0.28 * U))
          .child("·").frames(["·  ", "·· ", "···"], 380)));
    } else if (w.arrived) {
      const h = this.hang[a.address];
      const tick = Math.floor(now / 7000) + hash(a.address);
      if (h?.nap) els.push(bubble(tick % 4 ? "z z" : "z z · collecting garbage", "#3b3f4cd0", "#fff", 4.6).loop("top", { from: -1.05 * U, to: -1.25 * U, period: 2200 }));
      else if (h && tick % 3 === 0) {
        const here = SPOT_BABBLE[w.goal.replace(/(\d+|L|R)$/, "")];
        const lines = here && tick % 2 ? here : BABBLE;
        els.push(bubble(lines[Math.floor(tick / 3) % lines.length], "#ffffffe0", "#3a3f4c", 4.6));
      }
    }
    // A name tag under them: the tab at their desk, space and tab when they're up and about.
    const tag = atDesk ? a.tab_name : `${a.space_name} · ${a.tab_name}`;
    els.push(div().absolute().left(0.5 * U - 2 * U).w(4 * U).top(1.1 * U).flex().justify_center()
      .child(div().flex().items_center().gap(4).px(Math.max(4, 0.12 * U)).py(1).rounded(0.2 * U).bg("#1d2029d0").text_color("#f4f1ea").text_size(Math.max(11, 0.33 * U)).font_semibold()
        .child(div().w(0.2 * U).h(0.2 * U).rounded(0.1 * U).bg(STATUS[a.status] ?? STATUS.idle))
        .child(div().truncate().max_w(3.6 * U).child(tag))));
    return [this.moving(`o-${a.address}`, w).children(els)];
  }

  pong() {
    const U = this.U;
    const ball = this.O(5.2, 17.8, 0.18, "#fffbe8")
      .loop("left", { from: this.ox + 2.9 * U, to: this.ox + 7.4 * U, period: 1300, easing: "linear" })
      .loop("top", { from: this.oy + 16.9 * U, to: this.oy + 18.5 * U, period: 830, easing: "linear" });
    return [this.R(2.45, 17.6, 0.12, 0.4, "#d1495b", 0.05), this.R(7.95, 17.6, 0.12, 0.4, "#3d8be0", 0.05), ball];
  }

  meeting(away) {
    return away.slice(0, MEETING.length).map((a, i) => {
      const [x, y, face] = MEETING[i];
      const U = this.U;
      const pal = look(a.address);
      return div().id(`m-${a.address}`).absolute().left(this.ox + (x - 0.5) * U).top(this.oy + (y - 0.5) * U).w(U).h(U)
        .cursor_pointer().on_click(() => this.goTo(a)).on_hover(this.hover(a.address))
        .children([...this.body(pal, face, "sit", { typing: a.status === "working" }),
          div().absolute().left(0.2 * U).top(face === "down" ? 0.95 * U : -0.35 * U).w(0.6 * U).h(0.35 * U).rounded(0.05 * U).bg("#c9ced6"),
          div().absolute().left(0.38 * U).top(face === "down" ? 1.0 * U : -0.3 * U).w(0.24 * U).h(0.24 * U).rounded(0.12 * U).bg(STATUS[a.status] ?? STATUS.idle)]);
    });
  }

  // A big golden dog: trots about with its tail going, sleeps curled up in its bed.
  doggy(w) {
    const U = this.U * 1.6, c = this.U / 2;
    const [fx, fy] = FACE[w.face] ?? FACE.down;
    const side = fx !== 0;
    const at = (x, y, wd, h, color, r) => div().absolute().left(c + x * U - (wd * U) / 2).top(c + y * U - (h * U) / 2).w(wd * U).h(h * U).rounded(r * U).bg(color);
    const fur = "#c8873a", light = "#e2ac62", ear = "#8f5622", nose = "#2a1c14";
    let parts;
    if (w.arrived) {
      parts = [at(0, 0.05, 0.8, 0.62, "#00000028", 0.31), at(0, 0, 0.76, 0.6, fur, 0.3), at(-0.08, -0.02, 0.5, 0.38, light, 0.19),
        at(0.24, -0.12, 0.34, 0.32, fur, 0.16), at(0.36, -0.12, 0.12, 0.1, nose, 0.05), at(0.18, -0.26, 0.14, 0.2, ear, 0.07),
        at(-0.3, 0.2, 0.34, 0.12, fur, 0.06).loop("left", { from: c - 0.47 * U, to: c - 0.43 * U, period: 1800 })];
    } else {
      const L = (along, across) => side ? [fx * along, across] : [across, fy * along];
      const dims = (l, wd) => side ? [l, wd] : [wd, l];
      const legs = [[0.26, 0.17, 0], [0.26, -0.17, 1], [-0.24, 0.17, 1], [-0.24, -0.17, 0]].map(([al, ac, ph]) => {
        const [x, y] = L(al, ac), [lw, lh] = dims(0.14, 0.1);
        const prop = side ? "left" : "top";
        const base = c + (side ? x : y) * U - ((side ? lw : lh) * U) / 2;
        const sw = 0.07 * U;
        return at(x, y, lw, lh, ear, 0.04).loop(prop, ph ? { from: base + sw, to: base - sw, period: 300 } : { from: base - sw, to: base + sw, period: 300 });
      });
      const [bw, bh] = dims(0.86, 0.42), [hx, hy] = L(0.5, 0), [sx, sy] = L(0.68, 0), [tx, ty] = L(-0.55, 0), [tw, th] = dims(0.28, 0.09);
      const [e1x, e1y] = L(0.44, 0.17), [e2x, e2y] = L(0.44, -0.17), [ew, eh] = dims(0.14, 0.12);
      const tailProp = side ? "top" : "left", tailBase = c + (side ? ty : tx) * U - ((side ? th : tw) * U) / 2;
      parts = [at(0, 0.06, bw + 0.04, bh + 0.04, "#00000028", 0.22), ...legs,
        at(tx, ty, tw, th, fur, 0.04).loop(tailProp, { from: tailBase - 0.1 * U, to: tailBase + 0.1 * U, period: 260 }),
        at(0, 0, bw, bh, fur, 0.21), at(0, 0, side ? 0.5 : 0.22, side ? 0.22 : 0.5, light, 0.11),
        at(hx, hy, 0.36, 0.36, fur, 0.18), at(e1x, e1y, ew, eh, ear, 0.06), at(e2x, e2y, ew, eh, ear, 0.06),
        at(sx, sy, 0.16, 0.16, light, 0.08), at(sx + fx * 0.06, sy + fy * 0.06, 0.08, 0.08, nose, 0.04)];
    }
    return div().id("dog").absolute().left(this.ox + (w.x - 0.5) * this.U).top(this.oy + (w.y - 0.5) * this.U).w(this.U).h(this.U)
      .on_hover(this.hover("dog"))
      .transition("left", { duration: Math.max(1, w.dur), easing: "linear" }).transition("top", { duration: Math.max(1, w.dur), easing: "linear" })
      .children(parts);
  }

  // The room's light: darker at night (desk lamps on), warm at dawn and dusk.
  ambient(light, bySeat) {
    const els = [];
    if (light.warm > 0.005) els.push(div().absolute().left(0).top(0).right(0).bottom(0).bg("#ff8a4c").opacity(light.warm));
    if (light.dark > 0.005) els.push(div().absolute().left(0).top(0).right(0).bottom(0).bg("#0b1030").opacity(light.dark));
    if (light.dark > 0.15)
      SEATS.forEach((s, i) => {
        if (!bySeat[i] || s.desk === "laptop") return;
        els.push(this.O(s.desk.x + s.desk.w / 2, s.desk.y + s.desk.h / 2, 2.1, "#ffd27a1c"));
      });
    return els;
  }

  // Big windows in the outside walls, showing the sky (and stars at night).
  windows() {
    const R = this.R.bind(this);
    const { sky, dark } = this.light ?? { sky: SKY[3][1], dark: 0 };
    const els = [];
    for (const [x, y, len, vertical] of WINDOWS) {
      const t = 0.5;
      const [wx, wy, ww, wh] = vertical ? [x + 0.07, y, t - 0.14, len] : [x, y + 0.07, len, t - 0.14];
      els.push(R(wx - (vertical ? 0.03 : 0.08), wy - (vertical ? 0.08 : 0.03), ww + (vertical ? 0.06 : 0.16), wh + (vertical ? 0.16 : 0.06), "#cfd6df", 0.03));
      els.push(R(wx, wy, ww, wh, sky, 0.02));
      if (dark < 0.05) els.push(R(wx + (vertical ? 0.04 : len * 0.15), wy + (vertical ? len * 0.15 : 0.04), vertical ? 0.06 : len * 0.25, vertical ? len * 0.25 : 0.06, "#ffffff66"));
      if (dark > 0.2) for (let k = 0; k < len; k += 1.3) {
        const r = hash(`${x}${y}${k}`);
        els.push(R(wx + (vertical ? 0.05 + (r % 20) / 100 : k + (r % 9) / 10), wy + (vertical ? k + (r % 9) / 10 : 0.05 + (r % 20) / 100), 0.05, 0.05, "#fffbe0"));
      }
      for (let k = 1.6; k < len - 0.4; k += 1.6) els.push(vertical ? R(wx, wy + k, ww, 0.07, "#cfd6df") : R(wx + k, wy, 0.07, wh, "#cfd6df"));
    }
    return els;
  }

  // Sunlight falling in through the windows, sliding across the floor as the sun moves.
  sunlight(light) {
    if (light.sun <= 0.02) return [];
    const els = [];
    const drift = (light.hour - 12.5) * -0.18;
    const a = Math.round(light.sun * 0x30).toString(16).padStart(2, "0");
    for (const [x, y, len, vertical] of WINDOWS) {
      const deep = 2.2 * (1.2 - light.sun * 0.5);
      if (!vertical && y < 1) els.push(this.R(x + drift, 0.5, len, deep, "#fff1b8" + a, 0.1));
    }
    return els;
  }

  hud(list) {
    const n = (s) => list.filter((a) => a.status === s).length;
    const chip = (s, label) => div().flex().items_center().gap(5)
      .child(div().w(8).h(8).rounded(4).bg(STATUS[s])).child(`${n(s)} ${label}`);
    return div().absolute().left(0).right(0).top(this.oy).flex().justify_center().child(div().h(Math.max(20, 0.5 * this.U)).flex().items_center().gap(14).px(12)
      .rounded_b(8).bg("#1d2029f0").text_size(11).text_color("#e8e6e1")
      .child(div().font_semibold().child(`Office · ${clock(this.now)}`))
      .child(chip("working", "working")).child(chip("blocked", "blocked")).child(chip("done", "done")).child(chip("idle", "idle"))
      .child(div().id("back").cursor_pointer().px(8).py(1).rounded(5).bg("#ffffff1a").hover((s) => s.bg("#ffffff33"))
        .on_click(() => run("layout.switch", { name: WORKSPACE })).child("Back to workspace  ⌃⇧I")));
  }

  empty(text) {
    const U = this.U;
    return div().absolute().left(this.ox + 11 * U).top(this.oy + (C - 0.6) * U).w(22 * U).h(1.2 * U).flex().items_center().justify_center()
      .child(div().px(12).py(5).rounded(6).bg("#00000066").text_size(Math.max(11, 0.36 * U)).text_color("#fffaf0").child(text));
  }

  card(a, now) {
    const U = this.U;
    const w = this.w[a.address];
    let x, y;
    if (w) { x = w.x; y = w.y; } else {
      const i = (DEMO ? demoAgents(DEMO, now) : agents()).filter((k) => remote(k.address)).findIndex((k) => k.address === a.address);
      [x, y] = MEETING[Math.max(0, i)] ?? [5.5, 5];
    }
    const left = Math.min(this.ox + (x + 0.9) * U, this.size.width - 280);
    const top = Math.max(8, Math.min(this.oy + (y - 1.4) * U, this.size.height - 110));
    const since = a.status === "idle" ? this.idleSince[a.address] : a.status === "blocked" ? this.blockedSince[a.address] : null;
    const line = (s, c = "#c9c6bf") => div().truncate().text_color(c).child(s);
    return div().absolute().left(left).top(top).w(260).p(10).flex().flex_col().gap(3).rounded(8).bg("#1d2029f2").border(1).border_color("#ffffff26")
      .text_size(12).text_color("#f4f1ea")
      .child(div().flex().items_center().gap(6).font_semibold()
        .child(div().w(9).h(9).rounded(5).bg(STATUS[a.status] ?? STATUS.idle))
        .child(div().truncate().child(`${a.space_name} · ${a.tab_name}`)))
      .child(line(a.title || a.program?.name || "agent"))
      .child(line(`${a.program?.name ?? a.app ?? "agent"} · ${a.status}${since ? ` for ${ago(now - since)}` : ""}${remote(a.address) ? " · remote" : ""}`, "#9aa0aa"))
      .child(line("Click to open its terminal", "#7d8390"));
  }

  // The dog's name under it, like everyone's, and a "woof!" now and then when it's up.
  dogTag(w, now) {
    const U = this.U;
    const els = [div().absolute().left(0.5 * U - 2 * U).w(4 * U).top(1.15 * U).flex().justify_center()
      .child(div().flex().items_center().gap(4).px(Math.max(4, 0.12 * U)).py(1).rounded(0.2 * U).bg("#1d2029d0").text_color("#f4f1ea").text_size(Math.max(11, 0.33 * U)).font_semibold()
        .child(div().text_size(Math.max(10, 0.28 * U)).child("🐾")).child(DOG_NAME))];
    const resting = w.arrived && this.dog.spot.startsWith("dogbed");
    if (!resting && Math.floor(now / 6000) % 3 === 0)
      els.push(div().absolute().left(0.5 * U - 1.4 * U).w(2.8 * U).top(-1.0 * U).flex().justify_center()
        .child(div().px(Math.max(4, 0.14 * U)).py(1).rounded(0.2 * U).bg("#ffffffe0").text_color("#3a3f4c").text_size(Math.max(10, 0.3 * U)).font_semibold()
          .child(DOG_SAYS[Math.floor(now / 6000) % DOG_SAYS.length])));
    if (resting) els.push(div().absolute().left(0.5 * U - 1.4 * U).w(2.8 * U).top(-0.9 * U).flex().justify_center()
      .child(div().px(Math.max(4, 0.14 * U)).py(1).rounded(0.2 * U).bg("#3b3f4cd0").text_color("#fff").text_size(Math.max(10, 0.3 * U)).child("z z"))
      .loop("top", { from: -0.9 * U, to: -1.1 * U, period: 2200 }));
    return this.moving("dog-tag", w).children(els);
  }

  dogCard(w, now) {
    const U = this.U;
    const spot = this.dog.spot.startsWith("stroll") ? "stroll" : this.dog.spot;
    const doing = !w.arrived ? "Trotting around the office" : (DOG_DOING[spot] ?? DOG_DOING.stroll)[Math.floor(now / 15000) % (DOG_DOING[spot] ?? DOG_DOING.stroll).length];
    const left = Math.min(this.ox + (w.x + 0.9) * U, this.size.width - 280);
    const top = Math.max(8, Math.min(this.oy + (w.y - 1.4) * U, this.size.height - 110));
    const line = (s, c = "#c9c6bf") => div().truncate().text_color(c).child(s);
    return div().absolute().left(left).top(top).w(260).p(10).flex().flex_col().gap(3).rounded(8).bg("#1d2029f2").border(1).border_color("#ffffff26")
      .text_size(12).text_color("#f4f1ea")
      .child(div().flex().items_center().gap(6).font_semibold().child("🐾").child(`${DOG_NAME} · office dog`))
      .child(line(doing))
      .child(line(`${DOG_SAYS[Math.floor(now / 4000) % DOG_SAYS.length]} · ${DOG_MOOD[Math.floor(now / 20000) % DOG_MOOD.length]}`, "#9aa0aa"));
  }

  goTo(a) {
    if (!a.pane) return;
    run("pane.focus", { pane: a.pane });
    run("layout.switch", { name: WORKSPACE });
  }
}

// Pretend agents for DEMO: four teams, a mix of every status, changing every half minute.
function demoAgents(n, now) {
  const st = ["working", "idle", "idle", "blocked", "done", "idle", "working", "idle", "idle", "working", "idle", "idle", "working", "idle"];
  const t = Math.floor(now / 30000);
  const team = (i) => [0, 0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 0, 1, 2][i % 14];
  return Array.from({ length: n }, (_, i) => ({
    address: i === n - 1 ? "vps/t1" : `demo${i}`, pane: "", space: `demo-space-${team(i)}`,
    space_name: ["api", "web", "docs", "infra"][team(i)],
    tab: `t${i}`, tab_index: i, tab_name: String(i + 1), status: st[(i + (i > 5 ? t : 0)) % st.length],
    app: null, program: { key: ["claude", "codex", "gemini"][i % 3], name: ["Claude Code", "Codex", "Gemini"][i % 3] },
    title: "demo agent", seq: i, pinned: false, focused: false,
  }));
}

