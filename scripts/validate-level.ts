import { buildLevel, MOVE } from "../game/level";

const L = buildLevel();
const errs: string[] = [];

for (const h of L.hops) {
  if (h.shaft) continue;
  const where = `hop to x=${Math.round(h.to.x)},y=${Math.round(h.to.y)}`;
  if (h.req === "none") {
    if (h.gap > MOVE.gapNone) errs.push(`${where}: gap ${h.gap} > ${MOVE.gapNone}`);
    if (h.up > MOVE.upNone) errs.push(`${where}: rise ${h.up} > ${MOVE.upNone}`);
    if (h.up > 40 && h.gap > 120) errs.push(`${where}: rise ${h.up} with gap ${h.gap} is too hard`);
  } else if (h.req === "dash") {
    if (h.gap > MOVE.gapDash) errs.push(`${where}: dash gap ${h.gap} > ${MOVE.gapDash}`);
    if (h.up > MOVE.upDash) errs.push(`${where}: dash rise ${h.up} > ${MOVE.upDash}`);
  } else if (h.req === "double") {
    if (h.gap > MOVE.gapDouble) errs.push(`${where}: double gap ${h.gap} > ${MOVE.gapDouble}`);
    if (h.up > MOVE.upDouble) errs.push(`${where}: double rise ${h.up} > ${MOVE.upDouble}`);
    if (h.up > 120 && h.gap > 170) errs.push(`${where}: double rise ${h.up} with gap ${h.gap} is too hard`);
  }
}

// gated hops must come after the matching ability altar
const altarX: Record<string, number> = {};
for (const a of L.altars) altarX[a.ability] = a.x;
for (const h of L.hops) {
  const need = h.req === "none" ? null : h.req === "wall" ? "wall" : h.req;
  if (need && altarX[need] !== undefined && h.to.x < altarX[need] && !h.shaft)
    errs.push(`hop to x=${Math.round(h.to.x)} needs ${need} before its altar`);
}
for (const h of L.hops)
  if (h.shaft && h.to.x < (altarX.wall ?? 0)) errs.push(`shaft at x=${Math.round(h.to.x)} before wall altar`);

// overlap check: no platform body should intrude the standing space above another
for (const a of L.plats) {
  for (const b of L.plats) {
    if (a === b) continue;
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (overlapX <= 8) continue;
    // b sits above a: its underside (y+min(h,56)) must leave >= 100px over a's top, unless they touch/merge
    const bBottom = b.y + b.h;
    if (b.y < a.y && bBottom > a.y - 90 && b.y + 0 < a.y - 4 && b.h < 400) {
      // thin platform floating directly over another: check head clearance
      const clearance = a.y - bBottom;
      if (clearance < 80 && clearance > -a.h) errs.push(`low ceiling: plat@${Math.round(b.x)},${Math.round(b.y)} over plat@${Math.round(a.x)},${Math.round(a.y)} (clearance ${clearance})`);
    }
  }
}

// solid bodies must not intersect each other (would block the route)
for (let i = 0; i < L.plats.length; i++) {
  for (let j = i + 1; j < L.plats.length; j++) {
    const a = L.plats[i], b = L.plats[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 4 && oy > 4) errs.push();
  }
}

// solid bodies must not intersect each other (would block the route)
for (let i = 0; i < L.plats.length; i++) {
  for (let j = i + 1; j < L.plats.length; j++) {
    const a = L.plats[i];
    const b = L.plats[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 4 && oy > 4) {
      errs.push(`solid overlap: plat@${Math.round(a.x)},${Math.round(a.y)} (${a.w}x${a.h}) and plat@${Math.round(b.x)},${Math.round(b.y)} (${b.w}x${b.h})`);
    }
  }
}

// content sanity
const slots = L.lights.map((l) => l.slot).sort((a, b) => a - b);
if (slots.length !== 22 || slots.some((s, i) => s !== i)) errs.push(`lights must be slots 0..21, got ${slots.join(",")}`);
const foesGround = L.foes.length;
const wispCount = L.wisps.length;
const maxWispNeed = Math.max(...L.lights.filter((l) => l.kind === "wisps").map((l) => l.n ?? 0));
const maxKillNeed = Math.max(...L.lights.filter((l) => l.kind === "kills").map((l) => l.n ?? 0));
if (wispCount < maxWispNeed + 4) errs.push(`only ${wispCount} wisps for a ${maxWispNeed} requirement`);
if (foesGround < maxKillNeed) errs.push(`only ${foesGround} foes for a ${maxKillNeed} kill requirement (foes respawn at benches, so this is a soft limit)`);
if (L.tablets.length < 3) errs.push("need at least 3 tablets");

console.log(`platforms ${L.plats.length} · hops ${L.hops.length} · foes ${foesGround} · wisps ${wispCount} · tablets ${L.tablets.length}`);
console.log(`world width ${Math.round(L.bounds().maxX)} · y ${Math.round(L.bounds().minY)}..${Math.round(L.bounds().maxY)}`);
if (errs.length) {
  console.error("\nLEVEL PROBLEMS:\n - " + errs.join("\n - "));
  process.exit(1);
}
console.log("level OK");
