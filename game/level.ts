/**
 * The whole world, authored with a tiny "track" DSL so that every hop between
 * platforms is checked against what the player can actually do (see
 * scripts/validate-level.ts). No Phaser imports here, so it runs in Node too.
 */
export type Req = "none" | "dash" | "double" | "wall";
export type Plat = { x: number; y: number; w: number; h: number; zone: number };

export type LightKind = "reach" | "kills" | "wisps" | "boss" | "tablets" | "timer";
export type LightDef = {
  slot: number;
  x: number;
  y: number;
  zone: number;
  kind: LightKind;
  n?: number;
  boss?: string;
  title: string;
};
export type FoeType = "crawler" | "flyer" | "spitter" | "charger";
export type FoeDef = { type: FoeType; x: number; y: number; min: number; max: number; face: 1 | -1 };
export type WispDef = { id: string; x: number; y: number };
export type BenchDef = { id: string; x: number; y: number; zone: number };
export type AltarDef = { ability: "dash" | "wall" | "double"; x: number; y: number; zone: number };
export type TabletDef = { id: string; x: number; y: number; text: string };
export type SignDef = { x: number; y: number; text: string };
export type HazardDef = { x: number; y: number; w: number };
export type PlateDef = { x: number; y: number };
export type PointDef = { x: number; y: number };
export type GrubDef = { id: string; x: number; y: number };
export type LakeDef = { x: number; y: number; w: number };
export type BossId = "warden" | "archivist" | "unlit";
export type ArenaDef = {
  boss: BossId;
  x0: number; // left edge of arena floor
  x1: number; // right edge
  y: number; // floor top
  triggerX: number;
};

export type Hop = { gap: number; up: number; req: Req; from: Plat; to: Plat; shaft?: boolean };

export const ZONE_NAMES = [
  { name: "The Hollow Gate", sub: "Where the first light went out" },
  { name: "The Rootworks", sub: "Something grows here that was never planted" },
  { name: "The Drowned Archive", sub: "Every page remembers someone" },
  { name: "The Crown Below", sub: "The last of the dark" },
];

export class Level {
  plats: Plat[] = [];
  lights: LightDef[] = [];
  foes: FoeDef[] = [];
  wisps: WispDef[] = [];
  benches: BenchDef[] = [];
  altars: AltarDef[] = [];
  tablets: TabletDef[] = [];
  signs: SignDef[] = [];
  hazards: HazardDef[] = [];
  plates: PlateDef[] = [];
  arenas: ArenaDef[] = [];
  hops: Hop[] = [];
  /** Hidden extras (all optional side things; none of them gate a letter). */
  grubs: GrubDef[] = [];
  mapSpot: PointDef | null = null; // the folded map
  bank: PointDef | null = null; // the bank that closes
  millibelle: PointDef | null = null; // where she ends up
  flower: PointDef | null = null; // the fragile flower
  vase: PointDef | null = null; // where it goes
  quirrel: PointDef | null = null;
  lake: LakeDef | null = null;
  zoneStarts: number[] = [0, 0, 0, 0];
  spawn = { x: 0, y: 0 };
  timerMs = 16000;

  plat(x: number, y: number, w: number, zone: number, h?: number): Plat {
    const p = { x, y, w, h: h ?? (w < 260 ? 56 : 760), zone };
    this.plats.push(p);
    return p;
  }

  track(x: number, y: number, zone: number) {
    return new Track(this, x, y, zone);
  }

  bounds() {
    let minY = Infinity, maxY = -Infinity, maxX = 0;
    for (const p of this.plats) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + 200);
      maxX = Math.max(maxX, p.x + p.w);
    }
    return { minY, maxY, maxX };
  }
}

export class Track {
  last!: Plat;
  constructor(public L: Level, public x: number, public y: number, public zone: number) {}

  run(w: number): Plat {
    const p = this.L.plat(this.x, this.y, w, this.zone);
    this.x += w;
    this.last = p;
    return p;
  }

  /** gap = empty space before it; dy<0 means the new platform is higher. */
  hop(gap: number, dy: number, w: number, req: Req = "none", thin = false): Plat {
    const from = this.last;
    this.x += gap;
    this.y += dy;
    const p = this.L.plat(this.x, this.y, w, this.zone, thin ? 56 : undefined);
    this.L.hops.push({ gap, up: -dy, req, from, to: p });
    this.x += w;
    this.last = p;
    return p;
  }

  /** Branch to the LEFT of `from` (for secret ledges). Does not move this track. */
  chainLeft(from: Plat, steps: [number, number, number, Req?][]): Plat[] {
    const out: Plat[] = [];
    let prev = from;
    for (const [gap, dy, w, req] of steps) {
      const x = prev.x - gap - w;
      const p = this.L.plat(x, prev.y + dy, w, this.zone, 56);
      this.L.hops.push({ gap, up: -dy, req: req ?? "none", from: prev, to: p });
      out.push(p);
      prev = p;
    }
    return out;
  }

  /** Branch to the RIGHT (does not move this track). */
  chainRight(from: Plat, steps: [number, number, number, Req?][]): Plat[] {
    const out: Plat[] = [];
    let prev = from;
    for (const [gap, dy, w, req] of steps) {
      const x = prev.x + prev.w + gap;
      const p = this.L.plat(x, prev.y + dy, w, this.zone, 56);
      this.L.hops.push({ gap, up: -dy, req: req ?? "none", from: prev, to: p });
      out.push(p);
      prev = p;
    }
    return out;
  }

  /**
   * A wall-jump shaft the player climbs. Floor is contiguous with the previous
   * platform; a doorway at the bottom-left lets you in; exit ledge is on top right.
   */
  shaft(height: number, width = 150, exitW = 520): Plat {
    const sx = this.x;
    const y0 = this.y;
    const wallT = 60;
    // floor under the shaft
    const floor = this.L.plat(sx, y0, wallT + width, this.zone, 760);
    // left wall (leaves a 140px doorway above the floor)
    this.L.plat(sx, y0 - height, wallT, this.zone, height - 140);
    // right wall + exit ledge on top
    const exit = this.L.plat(sx + wallT + width, y0 - height, wallT + exitW, this.zone, height + 760);
    this.L.hops.push({ gap: 0, up: height, req: "wall", from: floor, to: exit, shaft: true });
    this.x = exit.x + exit.w;
    this.y = y0 - height;
    this.last = exit;
    return exit;
  }

  /** A pit with a floor you can drop into and wall-jump back out of. Returns the far platform. */
  well(depth: number, width: number, nextW: number): { floorY: number; far: Plat; floorX: number } {
    const prev = this.last;
    const x0 = this.x;
    const floorY = this.y + depth;
    this.L.plat(x0, floorY, width, this.zone, 400);
    const far = this.L.plat(x0 + width, this.y, nextW, this.zone);
    this.L.hops.push({ gap: width, up: 0, req: "none", from: prev, to: far });
    this.L.hops.push({ gap: 0, up: depth, req: "wall", from: prev, to: far, shaft: true });
    this.x = far.x + far.w;
    this.last = far;
    return { floorY, far, floorX: x0 + width / 2 };
  }
}

/* ------------------------------------------------------------------ */

const GY = 1800;
let L!: Level;

const light = (slot: number, p: Plat, ox: number, kind: LightKind, title: string, extra: Partial<LightDef> = {}) =>
  L.lights.push({ slot, x: p.x + ox, y: p.y, zone: p.zone, kind, title, ...extra });
const foe = (type: FoeType, p: Plat, ox: number, range = 160, y?: number) =>
  L.foes.push({
    type,
    x: p.x + ox,
    y: y ?? p.y,
    min: Math.max(p.x + 30, p.x + ox - range),
    max: Math.min(p.x + p.w - 30, p.x + ox + range),
    face: -1,
  });
let wispN = 0;
const wisp = (p: Plat, ox: number, up = 90) => L.wisps.push({ id: `w${wispN++}`, x: p.x + ox, y: p.y - up });
const bench = (id: string, p: Plat, ox: number) => L.benches.push({ id, x: p.x + ox, y: p.y, zone: p.zone });
const sign = (p: Plat, ox: number, text: string) => L.signs.push({ x: p.x + ox, y: p.y, text });
const spikes = (p: Plat, ox: number, w: number) => L.hazards.push({ x: p.x + ox, y: p.y, w });

let grubN = 0;
const grub = (p: Plat, ox: number) => L.grubs.push({ id: `g${grubN++}`, x: p.x + ox, y: p.y });

export function buildLevel(): Level {
  L = new Level();
  wispN = 0;
  grubN = 0;

  /* ===================== ZONE 1 — THE HOLLOW GATE ===================== */
  const t = L.track(0, GY, 0);
  const p0 = t.run(1000);
  L.spawn = { x: p0.x + 220, y: p0.y };
  bench("b0", p0, 140);
  sign(p0, 400, "← →   move");
  sign(p0, 690, "SPACE   jump  (hold for higher)");
  sign(p0, 940, "J   strike");

  const p1 = t.hop(110, 0, 440);
  foe("crawler", p1, 280, 150);
  wisp(p1, 100, 140);
  const p2 = t.hop(0, -70, 420);
  light(0, p2, 330, "reach", "The First Flame");
  sign(p2, 150, "Something is waiting up ahead");

  const p3 = t.hop(130, 60, 560);
  foe("crawler", p3, 200, 120);
  foe("crawler", p3, 420, 90);
  foe("flyer", p3, 300, 0, p3.y - 230);
  wisp(p3, 110, 100);
  wisp(p3, 300, 220);
  wisp(p3, 480, 100);

  const p4 = t.hop(110, -70, 320);
  wisp(p4, 160, 110);
  L.mapSpot = { x: p4.x + 60, y: p4.y }; // Cornifer's folded map
  grub(p4, 250); // the easy one
  const p5 = t.hop(100, -70, 400);
  light(1, p5, 300, "kills", "What Moves in the Dark", { n: 2 });
  foe("crawler", p5, 130, 100);
  const p6 = t.hop(120, 0, 440);
  light(2, p6, 340, "wisps", "The Gatherer's Lamp", { n: 2 });
  foe("flyer", p6, 220, 0, p6.y - 250);
  wisp(p6, 220, 150);

  // secret: a staircase of ledges climbing back over the pit
  const s1 = t.chainLeft(p5, [
    [105, -72, 170],
    [105, -72, 170],
    [105, -72, 170],
    [110, -72, 360],
  ]);
  const sec1 = s1[3];
  light(3, sec1, 220, "reach", "The Hidden Hearth");
  wisp(sec1, 80, 90);
  wisp(s1[1], 85, 90);
  grub(sec1, 320);

  const p7 = t.hop(130, 40, 560);
  bench("b1", p7, 110);
  L.bank = { x: p7.x + 320, y: p7.y }; // Millibelle's bank
  sign(p7, 480, "A heavy presence ahead");

  // Boss arena 1 (floor contiguous with p7)
  const a1 = t.hop(0, 0, 900);
  L.arenas.push({ boss: "warden", x0: a1.x, x1: a1.x + a1.w, y: a1.y, triggerX: a1.x + 180 });
  light(4, a1, 800, "boss", "The Warden's Vigil", { boss: "warden" });
  L.zoneStarts[1] = a1.x + a1.w;

  /* ===================== ZONE 2 — THE ROOTWORKS ===================== */
  t.zone = 1;
  const r0 = t.hop(0, 0, 520);
  bench("b2", r0, 90);
  L.altars.push({ ability: "dash", x: r0.x + 300, y: r0.y, zone: 1 });
  sign(r0, 430, "K   dash — try it over the gap");

  const r1 = t.hop(270, 0, 380, "dash");
  light(5, r1, 250, "reach", "The Swift Ember");
  wisp(r1, 90, 120);
  const r2 = t.hop(110, -60, 430);
  foe("crawler", r2, 180, 120);
  foe("crawler", r2, 340, 70);
  wisp(r2, 220, 170);
  const r3 = t.hop(110, -65, 280);
  foe("flyer", r3, 140, 0, r3.y - 230);
  wisp(r3, 140, 100);
  const r4 = t.hop(290, -20, 380, "dash");
  bench("b3", r4, 190);

  // secret: ledges climbing above the dash gap, ending past a second dash
  const s2 = t.chainLeft(r3, [
    [105, -72, 170],
    [105, -72, 170],
    [105, -72, 170],
    [290, -30, 460, "dash"],
  ]);
  light(9, s2[3], 250, "reach", "Above the Roots");
  wisp(s2[0], 85, 90);
  wisp(s2[3], 100, 90);
  grub(s2[1], 85);

  const r5 = t.hop(120, 90, 520);
  foe("crawler", r5, 190, 110);
  foe("crawler", r5, 340, 70);
  foe("spitter", r5, 470, 0);
  wisp(r5, 150, 110);
  // the fragile flower: pick it up here, carry it to the vase past the rune room
  L.flower = { x: r5.x + 60, y: r5.y };
  sign(r5, 60, "Please handle with care.");
  const r6 = t.hop(290, -10, 300, "dash");
  light(6, r6, 150, "reach", "The Far Ledge");
  grub(r6, 235);
  const r7 = t.hop(120, 0, 480);
  foe("crawler", r7, 150, 100);
  foe("crawler", r7, 290, 80);
  foe("flyer", r7, 220, 0, r7.y - 240);
  light(7, r7, 410, "kills", "The Hollow Count", { n: 5 });
  const r8 = t.hop(130, 60, 400);
  wisp(r8, 70, 100);
  wisp(r8, 160, 130);
  wisp(r8, 250, 100);
  light(8, r8, 330, "wisps", "The Collector", { n: 5 });

  // timed run: step on the rune, then dash across before it fades
  const r9 = t.hop(115, -50, 420);
  bench("b4", r9, 50);
  L.plates.push({ x: r9.x + 150, y: r9.y });
  L.vase = { x: r9.x + 350, y: r9.y };
  sign(r9, 250, "A rune hums underfoot");
  const c1 = t.hop(280, -10, 240, "dash");
  const c2 = t.hop(280, 0, 240, "dash");
  const c3 = t.hop(280, -20, 240, "dash");
  const c4 = t.hop(280, 0, 560, "dash");
  light(10, c4, 300, "timer", "The Hour Rune");
  spikes(c4, 410, 90);
  void c1; void c2; void c3;
  L.zoneStarts[2] = c4.x + c4.w;

  /* ===================== ZONE 3 — THE DROWNED ARCHIVE ===================== */
  t.zone = 2;
  const d0 = t.hop(130, 20, 560);
  bench("b5", d0, 80);
  L.altars.push({ ability: "wall", x: d0.x + 300, y: d0.y, zone: 2 });
  sign(d0, 430, "Press toward a wall in the air to cling. SPACE to leap off.");
  light(11, d0, 500, "reach", "The Quiet Shelf");

  // first shaft: climb 420px
  const e1 = t.shaft(420, 150, 380);
  light(12, e1, 260, "reach", "Above the Water");
  wisp(e1, 150, 100);
  foe("spitter", e1, 360, 0);

  const d1 = t.hop(130, 260, 480);
  L.tablets.push({ id: "t0", x: d1.x + 140, y: d1.y, text: "“They asked what the archive was for. I said: so nobody has to carry it alone.”" });
  foe("crawler", d1, 260, 100);
  foe("charger", d1, 390, 60);
  wisp(d1, 210, 110);

  const d2 = t.hop(115, -60, 400);
  foe("flyer", d2, 200, 0, d2.y - 240);
  wisp(d2, 190, 200);
  spikes(d2, 130, 100);

  // the well: looks like a death pit — it isn't
  const w1 = t.well(480, 130, 480);
  const wellFloor = { x: w1.floorX, y: w1.floorY, zone: 2 };
  L.lights.push({ slot: 15, x: wellFloor.x, y: wellFloor.y, zone: 2, kind: "reach", title: "The Drowned Lamp" });
  L.wisps.push({ id: `w${wispN++}`, x: wellFloor.x - 40, y: wellFloor.y - 100 });
  L.grubs.push({ id: `g${grubN++}`, x: wellFloor.x + 30, y: wellFloor.y });
  L.tablets.push({ id: "t1", x: w1.far.x + 200, y: w1.far.y, text: "“Some lights are kept at the bottom of things, where only the stubborn go.”" });
  foe("crawler", w1.far, 330, 100);

  const d3 = t.hop(110, -70, 360);
  foe("spitter", d3, 290, 0);
  foe("crawler", d3, 120, 60);
  wisp(d3, 150, 110);
  const d4 = t.hop(120, -40, 480);
  foe("charger", d4, 300, 100);
  foe("flyer", d4, 160, 0, d4.y - 250);
  L.tablets.push({ id: "t2", x: d4.x + 90, y: d4.y, text: "“Count them all. Twenty-two. Not one of them was an accident.”" });
  light(13, d4, 400, "tablets", "What the Tablets Said", { n: 3 });
  const d5 = t.hop(130, 60, 400);
  foe("crawler", d5, 170, 100);
  foe("crawler", d5, 300, 60);
  wisp(d5, 190, 110);
  const d6 = t.hop(120, 0, 440);
  light(14, d6, 340, "kills", "The Long Tally", { n: 8 });
  foe("charger", d6, 150, 80);
  const d7 = t.hop(120, 0, 480);
  bench("b6", d7, 60);
  sign(d7, 190, "The air is very still");
  L.millibelle = { x: d7.x + 340, y: d7.y }; // appears once the bank has closed

  const a2 = t.hop(0, 0, 880);
  L.arenas.push({ boss: "archivist", x0: a2.x, x1: a2.x + a2.w, y: a2.y, triggerX: a2.x + 180 });
  light(16, a2, 780, "boss", "The Archivist's Candle", { boss: "archivist" });
  L.zoneStarts[3] = a2.x + a2.w;

  /* ===================== ZONE 4 — THE CROWN BELOW ===================== */
  t.zone = 3;
  const k0 = t.hop(0, 0, 560);
  bench("b7", k0, 90);
  L.altars.push({ ability: "double", x: k0.x + 300, y: k0.y, zone: 3 });
  sign(k0, 440, "SPACE again in the air to leap twice");

  // the great climb: a floor to catch you, then stairs only the double jump can use
  const base = L.plat(k0.x + k0.w, k0.y + 40, 1700, 3);
  base.h = 760;
  const k1 = t.hop(120, -150, 260, "double", true);
  const k2 = t.hop(120, -150, 240, "double", true);
  const k3 = t.hop(120, -150, 240, "double", true);
  const k4 = t.hop(120, -150, 240, "double", true);
  const k5 = t.hop(120, -150, 240, "double", true);
  const k6 = t.hop(120, -150, 380, "double", true);
  foe("flyer", k3, 120, 0, k3.y - 190);
  foe("flyer", k5, 120, 0, k5.y - 190);
  wisp(k2, 120, 110);
  wisp(k4, 120, 110);
  wisp(k6, 100, 110);
  light(17, k6, 250, "reach", "The Crown Stair");
  bench("b8", k6, 50);

  // secret: climbs behind the stair to a ledge only reachable with both abilities
  const s3 = t.chainLeft(k6, [
    [130, -150, 220, "double"],
    [130, -150, 220, "double"],
    [290, -30, 480, "dash"],
  ]);
  light(19, s3[2], 250, "reach", "The High Secret");
  wisp(s3[0], 110, 100);
  wisp(s3[2], 100, 90);
  grub(s3[1], 110);

  // beyond the high secret: a quiet nook with a lake, and someone sitting by it
  const nook = t.chainLeft(s3[2], [[120, 0, 700]])[0];
  bench("b10", nook, 70);
  L.lake = { x: nook.x + 170, y: nook.y, w: 330 };
  L.quirrel = { x: nook.x + 580, y: nook.y };

  const k7 = t.hop(130, 120, 440);
  foe("charger", k7, 260, 100);
  foe("crawler", k7, 110, 60);
  wisp(k7, 220, 130);
  spikes(k7, 250, 100);
  const k8 = t.hop(280, -10, 300, "dash");
  const k9 = t.hop(120, -55, 300);
  foe("spitter", k9, 240, 0);
  const k10 = t.hop(290, 30, 420, "dash");
  foe("charger", k10, 260, 70);
  wisp(k10, 80, 110);
  wisp(k10, 200, 150);
  light(18, k10, 340, "wisps", "The Full Jar", { n: 8 });
  const k11 = t.hop(140, -150, 260, "double");
  const k12 = t.hop(170, 0, 440, "double");
  foe("flyer", k12, 220, 0, k12.y - 230);
  light(20, k12, 340, "reach", "The Last Stair");
  const k13 = t.hop(120, 40, 440);
  bench("b9", k13, 100);
  sign(k13, 280, "Whatever is below remembers every light that went out");
  void k8; void k11;

  const a3 = t.hop(0, 0, 1000);
  L.arenas.push({ boss: "unlit", x0: a3.x, x1: a3.x + a3.w, y: a3.y, triggerX: a3.x + 200 });
  light(21, a3, 900, "boss", "The Final Flame", { boss: "unlit" });

  return L;
}

/* ------------------------------------------------------------------ */
/* Movement envelope — keep in sync with GameScene constants          */
export const MOVE = {
  speed: 320,
  gravity: 1800,
  jumpV: 660,
  // conservative limits used by the validator
  gapNone: 135,
  upNone: 75,
  gapDash: 295,
  upDash: 35,
  gapDouble: 200,
  upDouble: 190,
};
