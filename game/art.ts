import * as Phaser from "phaser";

/** All art is drawn procedurally onto canvas textures: dark silhouettes, one warm light, pale eyes. */

export const ZONE_PAL = [
  { top: "#0a1325", bot: "#1d2d4a", rim: "#86abdb", rock: "#18223a", mist: 0x7fa6d6, tint: 0x9fc0ea },
  { top: "#061716", bot: "#14403a", rim: "#74d6ae", rock: "#10302b", mist: 0x62c9a0, tint: 0x8ee6c0 },
  { top: "#0e0c22", bot: "#2b2452", rim: "#ab9bff", rock: "#1b1936", mist: 0x9a8bf0, tint: 0xbdb0ff },
  { top: "#170c08", bot: "#4d2512", rim: "#ffb36b", rock: "#2a1710", mist: 0xf0a060, tint: 0xffc890 },
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h)!;
  draw(t.getContext());
  t.refresh();
}

const INK = "#080c16";
const INK2 = "#0c1424";
const PALE = "#eaf2ff";

function eye(g: CanvasRenderingContext2D, x: number, y: number, r = 2.5, color = PALE) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = 8;
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, r, r * 1.25, 0, 0, 7);
  g.fill();
  g.restore();
}

/* ------------------------------ player ------------------------------ */
type Pose = {
  ph?: number; lean?: number; bob?: number; scarf?: number; arm?: number; legs?: "stand" | "run" | "air" | "cling";
  blade?: boolean; squash?: number;
};

function drawBody(g: CanvasRenderingContext2D, o: Pose) {
  const lean = o.lean ?? 0, bob = o.bob ?? 0, ph = o.ph ?? 0;
  // scarf tail (behind)
  g.fillStyle = "#27408f";
  g.beginPath();
  const sc = o.scarf ?? 6;
  g.moveTo(27 + lean, 17 + bob);
  g.quadraticCurveTo(27 - sc * 0.6, 18 + bob + 2, 27 - sc, 20 + bob + (o.legs === "run" ? -2 : 6));
  g.quadraticCurveTo(27 - sc * 0.5, 25 + bob, 30 + lean, 22 + bob);
  g.fill();
  // legs
  g.fillStyle = "#04060b";
  const lA = o.legs === "run" ? Math.sin(ph * 6.283) * 7 : o.legs === "air" ? 3 : 0;
  const lB = o.legs === "run" ? -Math.sin(ph * 6.283) * 7 : o.legs === "air" ? -3 : 0;
  const lift = (v: number) => (o.legs === "run" ? Math.max(0, -v) * 0.5 : o.legs === "air" ? 2 : 0);
  g.beginPath(); g.roundRect(25 + lA, 55 - lift(lA), 6, 8 + lift(lA), 3); g.fill();
  g.beginPath(); g.roundRect(34 + lB, 55 - lift(lB), 6, 8 + lift(lB), 3); g.fill();
  // cloak (deep blue, tattered hem)
  g.fillStyle = "#142054";
  g.beginPath();
  g.moveTo(24 + lean, 16 + bob);
  g.quadraticCurveTo(32 + lean, 11 + bob, 40 + lean, 16 + bob);
  g.quadraticCurveTo(46 + lean * 0.4, 38, 50, 59);
  g.lineTo(44, 62); g.lineTo(38, 58); g.lineTo(32, 62); g.lineTo(26, 58); g.lineTo(20, 62); g.lineTo(14, 59);
  g.quadraticCurveTo(18 + lean * 0.4, 38, 24 + lean, 16 + bob);
  g.fill();
  // rim light on right edge
  g.strokeStyle = "rgba(120,160,255,0.85)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(40 + lean, 16 + bob);
  g.quadraticCurveTo(46 + lean * 0.4, 38, 50, 59);
  g.stroke();
  // inner fold
  g.strokeStyle = "rgba(60,80,120,0.5)";
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(32 + lean * 0.5, 26); g.lineTo(31, 58); g.stroke();
  // neck scarf
  g.fillStyle = "#3a58b8";
  g.beginPath(); g.roundRect(24 + lean, 14 + bob, 17, 6, 3); g.fill();
  // arm + lantern
  const ax = 46 + (o.arm ?? 0);
  const ay = 38 + (o.blade ? -10 : 0);
  g.strokeStyle = INK2;
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath(); g.moveTo(38 + lean * 0.5, 28 + bob); g.lineTo(ax, ay); g.stroke();
  if (o.blade) {
    g.fillStyle = "#cfe0f5";
    g.beginPath(); g.moveTo(ax, ay - 2); g.lineTo(ax + 15, ay - 9); g.lineTo(ax + 14, ay - 5); g.lineTo(ax + 1, ay + 2); g.closePath(); g.fill();
  }
  // lantern
  g.save();
  g.shadowColor = "#ffbf6b"; g.shadowBlur = 10;
  g.fillStyle = "#ffd58a";
  g.beginPath(); g.roundRect(ax - 3, ay + 2, 7, 9, 2); g.fill();
  g.restore();
  g.strokeStyle = "#2a1d10"; g.lineWidth = 1.2;
  g.beginPath(); g.roundRect(ax - 3, ay + 2, 7, 9, 2); g.stroke();
  g.beginPath(); g.moveTo(ax + 0.5, ay + 2); g.lineTo(ax + 0.5, ay - 1); g.stroke();
}

const POSES: Record<string, Pose[]> = {
  idle: [{ bob: 0, scarf: 7 }, { bob: 1, scarf: 9, arm: 1 }],
  run: Array.from({ length: 6 }, (_, i) => ({ ph: i / 6, legs: "run" as const, lean: 4, bob: Math.abs(Math.sin((i / 6) * 6.283)) * -1.5, scarf: 16, arm: Math.sin((i / 6) * 6.283) * 3 })),
  jump: [{ legs: "air", lean: 3, scarf: 14, bob: -1, arm: 4 }],
  fall: [{ legs: "air", lean: 1, scarf: 5, bob: 1, arm: -2 }],
  cling: [{ legs: "cling", lean: -2, scarf: 4 }],
  dash: [{ legs: "air", lean: 8, scarf: 24, bob: 3, arm: -2 }],
  hurt: [{ legs: "air", lean: -6, scarf: 10, bob: 2, arm: -4 }],
  attack: [{ legs: "stand", lean: 5, scarf: 12, blade: true, arm: 6 }],
};

export function makePlayerFrames(scene: Phaser.Scene) {
  for (const [name, frames] of Object.entries(POSES)) {
    frames.forEach((p, i) => canvasTex(scene, `pl_${name}_${i}`, 64, 64, (g) => drawBody(g, p)));
  }
}
export const FRAME_COUNT: Record<string, number> = Object.fromEntries(Object.entries(POSES).map(([k, v]) => [k, v.length]));

/**
 * The head: a pale, horned shell with two big dark eyes (a nod to the little knight everyone knows).
 * If /hero/face.png loaded, the photo is set into a round window in the shell instead of the eyes.
 */
export function makeHead(scene: Phaser.Scene) {
  const hasFace = scene.textures.exists("face_src");
  canvasTex(scene, "head", 64, 64, (g) => {
    const shell = g.createLinearGradient(0, 14, 0, 62);
    shell.addColorStop(0, "#f7f9ff");
    shell.addColorStop(1, "#c3cde6");
    // horns
    g.fillStyle = "#eef2fc";
    g.beginPath();
    g.moveTo(15, 31); g.quadraticCurveTo(6, 16, 14, 1); g.quadraticCurveTo(16, 14, 25, 22); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(49, 31); g.quadraticCurveTo(58, 16, 50, 1); g.quadraticCurveTo(48, 14, 39, 22); g.closePath(); g.fill();
    g.strokeStyle = "rgba(60,80,130,0.55)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(14, 1); g.quadraticCurveTo(16, 14, 25, 22); g.stroke();
    g.beginPath(); g.moveTo(50, 1); g.quadraticCurveTo(48, 14, 39, 22); g.stroke();
    // shell
    g.fillStyle = shell;
    g.beginPath();
    g.moveTo(32, 15);
    g.bezierCurveTo(50, 15, 56, 30, 54, 42);
    g.bezierCurveTo(52, 56, 42, 62, 32, 62);
    g.bezierCurveTo(22, 62, 12, 56, 10, 42);
    g.bezierCurveTo(8, 30, 14, 15, 32, 15);
    g.fill();
    g.strokeStyle = "rgba(20,30,70,0.7)"; g.lineWidth = 1.4; g.stroke();
    // cool rim light on the right
    g.strokeStyle = "rgba(140,175,255,0.7)"; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(47, 20); g.bezierCurveTo(55, 30, 56, 44, 49, 55); g.stroke();
    // small crease on the brow
    g.strokeStyle = "rgba(60,70,110,0.55)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(32, 15); g.lineTo(32, 22); g.stroke();
    if (hasFace) {
      // PHOTO: set into a round window in the shell
      const cx = 32, cy = 40, r = 18;
      g.save();
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
      const img = scene.textures.get("face_src").getSourceImage() as HTMLImageElement;
      const sc = Math.max((r * 2) / img.width, (r * 2) / img.height);
      const w = img.width * sc, h = img.height * sc;
      g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      g.fillStyle = "rgba(90,120,170,0.14)"; g.fillRect(0, 0, 64, 64);
      g.restore();
      g.strokeStyle = "rgba(20,30,70,0.8)"; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    } else {
      // PLACEHOLDER: the empty mask, two big dark eyes
      g.fillStyle = "#05070d";
      g.beginPath(); g.ellipse(23, 41, 6.5, 9.5, 0.28, 0, 7); g.fill();
      g.beginPath(); g.ellipse(41, 41, 6.5, 9.5, -0.28, 0, 7); g.fill();
    }
  });
}

/* ------------------------------ enemies ------------------------------ */
function makeEnemies(scene: Phaser.Scene) {
  // crawler: 2 frames
  for (let f = 0; f < 2; f++) {
    canvasTex(scene, `crawler_${f}`, 56, 36, (g) => {
      g.fillStyle = INK;
      g.strokeStyle = INK; g.lineWidth = 3; g.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const x = 14 + i * 10, o = (i + f) % 2 ? 3 : -2;
        g.beginPath(); g.moveTo(x, 26); g.lineTo(x + o, 34); g.stroke();
      }
      g.beginPath(); g.ellipse(28, 20, 24, 14, 0, Math.PI, 0); g.lineTo(52, 26); g.lineTo(4, 26); g.fill();
      g.strokeStyle = "rgba(160,190,230,0.45)"; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(28, 20, 22, 12, 0, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(16 + i * 10, 10); g.lineTo(18 + i * 10, 22); g.stroke(); }
      eye(g, 44, 19, 2.2); eye(g, 38, 17, 1.6);
    });
  }
  // flyer: 2 wing frames
  for (let f = 0; f < 2; f++) {
    canvasTex(scene, `flyer_${f}`, 64, 56, (g) => {
      const wy = f ? 8 : 26;
      g.fillStyle = "rgba(120,150,200,0.45)";
      g.beginPath(); g.moveTo(32, 30); g.quadraticCurveTo(8, wy - 14, 2, wy); g.quadraticCurveTo(18, wy + 10, 32, 32); g.fill();
      g.beginPath(); g.moveTo(32, 30); g.quadraticCurveTo(56, wy - 14, 62, wy); g.quadraticCurveTo(46, wy + 10, 32, 32); g.fill();
      g.fillStyle = INK;
      g.beginPath(); g.ellipse(32, 34, 11, 14, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(26, 22); g.lineTo(22, 12); g.lineTo(31, 20); g.fill();
      g.beginPath(); g.moveTo(38, 22); g.lineTo(42, 12); g.lineTo(33, 20); g.fill();
      eye(g, 32, 31, 3.2, "#ffe3b0");
    });
  }
  canvasTex(scene, "spitter", 48, 72, (g) => {
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(20, 72); g.quadraticCurveTo(18, 40, 24, 30); g.lineTo(30, 30); g.quadraticCurveTo(32, 40, 30, 72); g.fill();
    g.beginPath(); g.moveTo(8, 72); g.quadraticCurveTo(16, 62, 22, 62); g.lineTo(26, 72); g.fill();
    g.beginPath(); g.ellipse(24, 22, 17, 17, 0, 0, 7); g.fill();
    g.fillStyle = "#1a1030";
    g.beginPath(); g.ellipse(24, 24, 9, 8, 0, 0, 7); g.fill();
    eye(g, 24, 24, 3.5, "#ffd0a0");
    g.strokeStyle = "rgba(160,190,230,0.4)"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(24, 22, 16, Math.PI * 1.2, Math.PI * 1.85); g.stroke();
  });
  canvasTex(scene, "charger", 84, 56, (g) => {
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(6, 52); g.quadraticCurveTo(0, 20, 28, 12); g.quadraticCurveTo(58, 4, 70, 22); g.lineTo(80, 34); g.lineTo(70, 40); g.lineTo(70, 52); g.closePath(); g.fill();
    g.fillRect(14, 44, 10, 12); g.fillRect(48, 44, 10, 12);
    g.fillStyle = "#d8dce6";
    g.beginPath(); g.moveTo(66, 20); g.lineTo(80, 4); g.lineTo(74, 24); g.fill();
    g.beginPath(); g.moveTo(58, 16); g.lineTo(66, 0); g.lineTo(64, 20); g.fill();
    g.strokeStyle = "rgba(160,190,230,0.45)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(10, 36); g.quadraticCurveTo(28, 6, 60, 12); g.stroke();
    eye(g, 62, 28, 2.6, "#ffb0a0");
  });
  canvasTex(scene, "bolt", 22, 22, (g) => {
    const gr = g.createRadialGradient(11, 11, 0, 11, 11, 11);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.35, "#e7c8ff"); gr.addColorStop(1, "rgba(150,90,220,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 22, 22);
  });
  canvasTex(scene, "wave", 70, 46, (g) => {
    const gr = g.createLinearGradient(0, 46, 0, 0);
    gr.addColorStop(0, "rgba(220,200,255,0.9)"); gr.addColorStop(1, "rgba(220,200,255,0)");
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 46); g.quadraticCurveTo(10, 20, 35, 2); g.quadraticCurveTo(60, 20, 70, 46); g.fill();
  });
  canvasTex(scene, "ember", 16, 16, (g) => {
    const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    gr.addColorStop(0, "#fff7e0"); gr.addColorStop(0.4, "#ffb86b"); gr.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
  });
}

function makeBosses(scene: Phaser.Scene) {
  // Warden — tall armoured husk with a pale mask
  canvasTex(scene, "warden", 170, 190, (g) => {
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(30, 188); g.lineTo(26, 90); g.quadraticCurveTo(24, 50, 60, 44); g.lineTo(110, 44); g.quadraticCurveTo(146, 50, 144, 90); g.lineTo(140, 188); g.lineTo(100, 178); g.lineTo(85, 188); g.lineTo(70, 178); g.closePath(); g.fill();
    // pauldrons
    g.beginPath(); g.moveTo(14, 70); g.lineTo(34, 40); g.lineTo(62, 62); g.lineTo(40, 96); g.fill();
    g.beginPath(); g.moveTo(156, 70); g.lineTo(136, 40); g.lineTo(108, 62); g.lineTo(130, 96); g.fill();
    // arms hanging
    g.fillRect(10, 90, 22, 80); g.fillRect(138, 90, 22, 80);
    // head
    g.beginPath(); g.ellipse(85, 40, 30, 34, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(58, 18); g.lineTo(52, -2); g.lineTo(70, 10); g.fill();
    g.beginPath(); g.moveTo(112, 18); g.lineTo(118, -2); g.lineTo(100, 10); g.fill();
    g.fillStyle = "#cfd6e2";
    g.beginPath(); g.ellipse(85, 44, 22, 26, 0, 0, 7); g.fill();
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(76, 42, 5, 8, 0.2, 0, 7); g.fill();
    g.beginPath(); g.ellipse(94, 42, 5, 8, -0.2, 0, 7); g.fill();
    g.fillRect(83, 54, 4, 14);
    g.strokeStyle = "rgba(150,180,225,0.5)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 100); g.lineTo(30, 180); g.moveTo(60, 48); g.quadraticCurveTo(85, 40, 110, 48); g.stroke();
    // chest crack glowing faint
    g.strokeStyle = "rgba(255,190,110,0.55)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(85, 80); g.lineTo(78, 110); g.lineTo(88, 130); g.lineTo(82, 160); g.stroke();
  });
  // Archivist — a great moth with page-like wings
  canvasTex(scene, "archivist", 260, 190, (g) => {
    const wing = (dir: number) => {
      g.save(); g.translate(130, 90); g.scale(dir, 1);
      g.fillStyle = "rgba(24,22,46,0.96)";
      g.beginPath(); g.moveTo(8, -10); g.quadraticCurveTo(70, -90, 124, -40); g.quadraticCurveTo(128, 30, 80, 70); g.quadraticCurveTo(40, 60, 8, 20); g.closePath(); g.fill();
      g.strokeStyle = "rgba(190,175,255,0.5)"; g.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(10, 0 + i * 3); g.quadraticCurveTo(60 + i * 10, -50 + i * 14, 118 - i * 4, -30 + i * 14); g.stroke(); }
      g.fillStyle = "rgba(230,222,255,0.75)";
      g.beginPath(); g.ellipse(80, -10, 16, 20, 0.3, 0, 7); g.fill();
      g.fillStyle = INK; g.beginPath(); g.ellipse(80, -10, 6, 9, 0.3, 0, 7); g.fill();
      g.restore();
    };
    wing(1); wing(-1);
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(130, 96, 20, 52, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(130, 56, 17, 18, 0, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(124, 42); g.quadraticCurveTo(110, 14, 96, 18); g.moveTo(136, 42); g.quadraticCurveTo(150, 14, 164, 18); g.stroke();
    eye(g, 123, 56, 3.2, "#ffe3b0"); eye(g, 137, 56, 3.2, "#ffe3b0");
  });
  // The Unlit — a crowned husk with a dark hollow where a flame should be
  canvasTex(scene, "unlit", 200, 230, (g) => {
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(34, 228); g.lineTo(30, 110); g.quadraticCurveTo(30, 62, 100, 56); g.quadraticCurveTo(170, 62, 170, 110); g.lineTo(166, 228); g.lineTo(120, 214); g.lineTo(100, 228); g.lineTo(80, 214); g.closePath(); g.fill();
    g.fillRect(8, 100, 26, 96); g.fillRect(166, 100, 26, 96);
    // crown
    g.fillStyle = "#0e1020";
    g.beginPath(); g.moveTo(56, 36); g.lineTo(60, 2); g.lineTo(80, 24); g.lineTo(100, -4); g.lineTo(120, 24); g.lineTo(140, 2); g.lineTo(144, 36); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(100, 52, 36, 38, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,190,110,0.6)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(60, 4); g.lineTo(80, 24); g.lineTo(100, -2); g.lineTo(120, 24); g.lineTo(140, 4); g.stroke();
    eye(g, 86, 52, 4, "#ffe9c0"); eye(g, 114, 52, 4, "#ffe9c0");
    // hollow lantern chest
    g.fillStyle = "#020308";
    g.beginPath(); g.ellipse(100, 128, 26, 34, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,190,110,0.8)"; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(100, 128, 26, 34, 0, 0, 7); g.stroke();
    g.strokeStyle = "rgba(255,190,110,0.35)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(100, 94); g.lineTo(100, 162); g.moveTo(74, 128); g.lineTo(126, 128); g.stroke();
  });
}

/* ------------------------------ props ------------------------------ */
function makeProps(scene: Phaser.Scene) {
  for (const on of [false, true]) {
    canvasTex(scene, on ? "lantern_on" : "lantern_off", 64, 150, (g) => {
      g.strokeStyle = "#0a0e18"; g.fillStyle = "#0a0e18"; g.lineWidth = 5; g.lineCap = "round";
      g.beginPath(); g.moveTo(32, 150); g.lineTo(32, 56); g.stroke();
      g.beginPath(); g.moveTo(14, 150); g.lineTo(50, 150); g.lineTo(44, 138); g.lineTo(20, 138); g.closePath(); g.fill();
      // hook + cage
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(32, 56); g.quadraticCurveTo(32, 36, 32, 30); g.stroke();
      g.fillStyle = on ? "rgba(255,210,140,0.35)" : "rgba(120,140,170,0.12)";
      g.beginPath(); g.roundRect(18, 6, 28, 40, 6); g.fill();
      g.strokeStyle = on ? "#3a2810" : "#202a3c"; g.lineWidth = 3;
      g.beginPath(); g.roundRect(18, 6, 28, 40, 6); g.stroke();
      g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 46); g.moveTo(18, 26); g.lineTo(46, 26); g.stroke();
      g.fillStyle = "#0a0e18"; g.beginPath(); g.moveTo(14, 8); g.lineTo(32, -2); g.lineTo(50, 8); g.closePath(); g.fill();
      if (on) {
        const gr = g.createRadialGradient(32, 28, 0, 32, 28, 16);
        gr.addColorStop(0, "#fffbe8"); gr.addColorStop(0.35, "#ffcf7a"); gr.addColorStop(1, "rgba(255,150,60,0)");
        g.fillStyle = gr; g.fillRect(10, 8, 44, 40);
      } else {
        g.fillStyle = "rgba(150,165,190,0.5)"; g.beginPath(); g.ellipse(32, 36, 3, 4, 0, 0, 7); g.fill();
      }
    });
  }
  canvasTex(scene, "bench", 96, 54, (g) => {
    g.fillStyle = "#0a0e18";
    g.beginPath(); g.roundRect(4, 28, 88, 14, 4); g.fill();
    g.fillRect(12, 40, 10, 14); g.fillRect(74, 40, 10, 14);
    g.beginPath(); g.roundRect(8, 10, 12, 22, 3); g.fill();
    g.strokeStyle = "rgba(143,179,217,0.55)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(6, 29); g.lineTo(90, 29); g.stroke();
    // small lamp
    g.fillStyle = "#ffd58a"; g.shadowColor = "#ffbf6b"; g.shadowBlur = 10;
    g.beginPath(); g.roundRect(11, 4, 6, 8, 2); g.fill();
  });
  canvasTex(scene, "altar", 72, 96, (g) => {
    g.fillStyle = "#0a0e18";
    g.beginPath(); g.moveTo(8, 96); g.lineTo(16, 50); g.lineTo(56, 50); g.lineTo(64, 96); g.closePath(); g.fill();
    g.beginPath(); g.roundRect(6, 44, 60, 12, 3); g.fill();
    g.strokeStyle = "rgba(143,179,217,0.55)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(6, 45); g.lineTo(66, 45); g.stroke();
  });
  canvasTex(scene, "tablet", 48, 76, (g) => {
    g.fillStyle = "#0d1322";
    g.beginPath(); g.moveTo(4, 76); g.lineTo(6, 14); g.quadraticCurveTo(24, -2, 42, 14); g.lineTo(44, 76); g.closePath(); g.fill();
    g.strokeStyle = "rgba(160,190,230,0.45)"; g.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(12, 26 + i * 11); g.lineTo(36 - (i % 2) * 8, 26 + i * 11); g.stroke(); }
  });
  canvasTex(scene, "rune", 90, 20, (g) => {
    g.fillStyle = "#0d1322"; g.beginPath(); g.roundRect(0, 8, 90, 12, 4); g.fill();
    g.strokeStyle = "rgba(255,190,110,0.8)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(30, 14); g.lineTo(45, 10); g.lineTo(60, 14); g.lineTo(45, 18); g.closePath(); g.stroke();
  });
  canvasTex(scene, "spikes", 32, 26, (g) => {
    g.fillStyle = "#06080f";
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(i * 11 - 1, 26); g.lineTo(i * 11 + 5, 2); g.lineTo(i * 11 + 11, 26); g.fill(); }
    g.strokeStyle = "rgba(200,170,220,0.5)"; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(i * 11 + 5, 2); g.lineTo(i * 11 + 11, 26); g.stroke(); }
  });
  canvasTex(scene, "wisp", 48, 48, (g) => {
    const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.2, "#bfe4ff"); gr.addColorStop(0.5, "rgba(120,180,255,0.35)"); gr.addColorStop(1, "rgba(120,180,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  });
}

function makeFx(scene: Phaser.Scene) {
  canvasTex(scene, "dot", 12, 12, (g) => {
    const gr = g.createRadialGradient(6, 6, 0, 6, 6, 6);
    gr.addColorStop(0, "#fff"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 12, 12);
  });
  canvasTex(scene, "glow", 256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  });
  canvasTex(scene, "slash", 130, 130, (g) => {
    const gr = g.createLinearGradient(0, 0, 130, 0);
    gr.addColorStop(0, "rgba(255,255,255,0.1)"); gr.addColorStop(0.7, "rgba(235,245,255,0.95)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath(); g.arc(10, 65, 100, -0.85, 0.85); g.arc(52, 65, 80, 0.85, -0.85, true); g.closePath(); g.fill();
  });
  canvasTex(scene, "fog", 1280, 320, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 320);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,0.55)");
    g.fillStyle = gr; g.fillRect(0, 0, 1280, 320);
  });
}

/* ------------------------------ world ------------------------------ */
const BG_W = 1024;

function bgLayers(scene: Phaser.Scene, zone: number) {
  const pal = ZONE_PAL[zone];
  const R = rng(zone * 9973 + 11);
  const wrap = (x: number, w: number, fn: (x: number) => void) => {
    fn(x);
    if (x + w > BG_W) fn(x - BG_W);
    if (x - w < 0) fn(x + BG_W);
  };

  // far: gradient + glows + distant forms
  canvasTex(scene, `bg_${zone}_0`, BG_W, 720, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 720);
    gr.addColorStop(0, pal.top); gr.addColorStop(1, pal.bot);
    g.fillStyle = gr; g.fillRect(0, 0, BG_W, 720);
    for (let i = 0; i < 4; i++) {
      const x = R() * BG_W, y = 160 + R() * 380, r = 160 + R() * 160;
      wrap(x, r, (xx) => {
        const rg = g.createRadialGradient(xx, y, 0, xx, y, r);
        rg.addColorStop(0, "rgba(180,200,240,0.07)"); rg.addColorStop(1, "rgba(180,200,240,0)");
        g.fillStyle = rg; g.fillRect(xx - r, y - r, r * 2, r * 2);
      });
    }
    g.fillStyle = "rgba(0,0,0,0.28)";
    for (let i = 0; i < 7; i++) {
      const x = i * (BG_W / 7) + R() * 40, w = 50 + R() * 60, top = 120 + R() * 200;
      if (zone === 2) { g.fillRect(x, top, w, 720 - top); }
      else if (zone === 3) { g.fillRect(x, top, w * 0.7, 720 - top); g.fillRect(x - 12, top, w * 0.7 + 24, 14); }
      else { g.beginPath(); g.moveTo(x, 720); g.lineTo(x, top + w); g.quadraticCurveTo(x + w / 2, top - w * 0.4, x + w, top + w); g.lineTo(x + w, 720); g.fill(); }
    }
  });

  // mid: hanging shapes from the ceiling + mid columns
  canvasTex(scene, `bg_${zone}_1`, BG_W, 720, (g) => {
    g.fillStyle = "rgba(4,7,14,0.62)";
    g.strokeStyle = "rgba(4,7,14,0.62)";
    for (let i = 0; i < 14; i++) {
      const x = R() * BG_W, len = 80 + R() * 260, w = 14 + R() * 38;
      wrap(x, w, (xx) => {
        if (zone === 1) { g.lineWidth = 3 + R() * 4; g.beginPath(); g.moveTo(xx, 0); g.bezierCurveTo(xx + 30, len * 0.3, xx - 30, len * 0.7, xx + 8, len); g.stroke(); }
        else if (zone === 2 && i % 3 === 0) { g.fillRect(xx - 3, 0, 6, len * 0.8); g.beginPath(); g.arc(xx, len * 0.8 + 6, 8, 0, 7); g.fill(); }
        else if (zone === 3) { g.beginPath(); g.moveTo(xx - w, 0); g.lineTo(xx + w, 0); g.lineTo(xx + w * 0.3, len); g.lineTo(xx, len + 30); g.lineTo(xx - w * 0.3, len); g.fill(); }
        else { g.beginPath(); g.moveTo(xx - w, 0); g.lineTo(xx + w, 0); g.lineTo(xx, len); g.fill(); }
      });
    }
    // floor-side silhouettes
    for (let i = 0; i < 9; i++) {
      const x = R() * BG_W, h = 90 + R() * 220, w = 24 + R() * 50;
      wrap(x, w, (xx) => {
        if (zone === 1) { g.beginPath(); g.moveTo(xx, 720); g.quadraticCurveTo(xx - 6, 720 - h, xx + 10, 720 - h - 20); g.quadraticCurveTo(xx + 30, 720 - h * 0.5, xx + w, 720); g.fill(); }
        else if (zone === 2) { g.fillRect(xx, 720 - h, w * 1.6, h); g.strokeStyle = "rgba(180,170,255,0.08)"; g.lineWidth = 1; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(xx, 720 - h + k * h / 6); g.lineTo(xx + w * 1.6, 720 - h + k * h / 6); g.stroke(); } g.strokeStyle = "rgba(4,7,14,0.62)"; }
        else if (zone === 3) { g.fillRect(xx, 720 - h - 60, w * 0.8, h + 60); g.fillRect(xx - 8, 720 - h - 66, w * 0.8 + 16, 14); }
        else { g.beginPath(); g.moveTo(xx - w, 720); g.lineTo(xx, 720 - h); g.lineTo(xx + w, 720); g.fill(); }
      });
    }
  });

  // near: dark foreground silhouettes & motes
  canvasTex(scene, `bg_${zone}_2`, BG_W, 720, (g) => {
    g.fillStyle = "rgba(2,4,9,0.9)";
    for (let i = 0; i < 6; i++) {
      const x = R() * BG_W, len = 40 + R() * 150, w = 10 + R() * 28;
      wrap(x, w, (xx) => { g.beginPath(); g.moveTo(xx - w, 0); g.lineTo(xx + w, 0); g.lineTo(xx, len); g.fill(); });
    }
    g.fillStyle = "rgba(2,4,9,0.92)";
    for (let i = 0; i < 5; i++) {
      const x = R() * BG_W, h = 30 + R() * 80, w = 40 + R() * 90;
      wrap(x, w, (xx) => { g.beginPath(); g.moveTo(xx - w, 720); g.quadraticCurveTo(xx, 720 - h * 2, xx + w, 720); g.fill(); });
    }
  });

  // rock tile + rim tuft
  canvasTex(scene, `rock_${zone}`, 128, 128, (g) => {
    g.fillStyle = pal.rock; g.fillRect(0, 0, 128, 128);
    const rr = rng(zone * 31 + 7);
    for (let i = 0; i < 220; i++) {
      const a = rr() * 0.22;
      g.fillStyle = rr() > 0.5 ? `rgba(255,255,255,${a * 0.35})` : `rgba(0,0,0,${a * 2})`;
      const w = 2 + rr() * 14, h = 2 + rr() * 8;
      g.fillRect(rr() * 128, rr() * 128, w, h);
    }
    g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      let x = rr() * 128, y = rr() * 128; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rr() * 24 - 12; y += rr() * 20; g.lineTo(x, y); }
      g.stroke();
    }
  });
  canvasTex(scene, `rim_${zone}`, 64, 14, (g) => {
    const rr = rng(zone * 77 + 3);
    g.fillStyle = pal.rim;
    g.fillRect(0, 9, 64, 5);
    for (let i = 0; i < 9; i++) {
      const x = (i * 7 + rr() * 4) % 64, h = 3 + rr() * 6;
      g.beginPath(); g.moveTo(x - 2, 10); g.lineTo(x, 10 - h); g.lineTo(x + 2, 10); g.fill();
    }
    g.globalAlpha = 0.55; g.fillStyle = "#fff"; g.fillRect(0, 9, 64, 1.5);
  });
}

/* ------------------------- little nods & secrets ------------------------- */
function drawGrub(g: CanvasRenderingContext2D, ox: number, oy: number, s = 1) {
  g.save();
  g.translate(ox, oy);
  g.scale(s, s);
  // body: three soft segments
  g.fillStyle = "#7fbf5a";
  g.beginPath(); g.ellipse(18, 10, 12, 8, 0, 0, 7); g.fill();
  g.fillStyle = "#8fd06a";
  g.beginPath(); g.ellipse(8, 11, 8, 6.5, 0, 0, 7); g.fill();
  g.fillStyle = "#a6dc7e";
  g.beginPath(); g.ellipse(-2, 12, 6, 5, 0, 0, 7); g.fill();
  g.strokeStyle = "rgba(40,80,30,0.5)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(13, 3); g.lineTo(13, 17); g.moveTo(4, 5); g.lineTo(4, 17); g.stroke();
  // face
  g.fillStyle = "#f4f8e8";
  g.beginPath(); g.ellipse(26, 9, 6, 5.5, 0, 0, 7); g.fill();
  g.fillStyle = "#101a10";
  g.beginPath(); g.arc(24.5, 8, 1.3, 0, 7); g.fill();
  g.beginPath(); g.arc(28.5, 8, 1.3, 0, 7); g.fill();
  g.strokeStyle = "#101a10"; g.lineWidth = 1;
  g.beginPath(); g.arc(26.5, 11, 2, 0.2, 2.9); g.stroke();
  g.restore();
}

function drawFlower(g: CanvasRenderingContext2D, cx: number, base: number) {
  g.strokeStyle = "#5c8a4a"; g.lineWidth = 2.5; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx, base); g.quadraticCurveTo(cx - 3, base - 20, cx, base - 36); g.stroke();
  g.fillStyle = "#6e9d55";
  g.beginPath(); g.ellipse(cx - 6, base - 14, 6, 2.6, -0.6, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 6, base - 20, 6, 2.6, 0.6, 0, 7); g.fill();
  g.save();
  g.translate(cx, base - 42);
  g.shadowColor = "#ffffff"; g.shadowBlur = 8;
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    g.fillStyle = i % 2 ? "#ffffff" : "#f1f5ff";
    g.beginPath(); g.ellipse(0, -8, 4.6, 8, 0, 0, 7); g.fill();
  }
  g.shadowBlur = 0;
  g.fillStyle = "#f2c868";
  g.beginPath(); g.arc(0, 0, 3.4, 0, 7); g.fill();
  g.restore();
}

function makeExtras(scene: Phaser.Scene) {
  // grub in a little glass jar
  canvasTex(scene, "grub_jar", 56, 64, (g) => {
    g.fillStyle = "rgba(150,210,200,0.2)";
    g.beginPath(); g.roundRect(6, 14, 44, 46, 10); g.fill();
    drawGrub(g, 9, 28, 0.85);
    g.strokeStyle = "rgba(190,235,225,0.75)"; g.lineWidth = 2;
    g.beginPath(); g.roundRect(6, 14, 44, 46, 10); g.stroke();
    g.fillStyle = "#4a3320"; g.beginPath(); g.roundRect(10, 6, 36, 10, 3); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(13, 24); g.lineTo(13, 46); g.stroke();
  });
  canvasTex(scene, "grub", 44, 28, (g) => drawGrub(g, 4, 4, 1));

  // the delicate flower
  canvasTex(scene, "flower", 32, 60, (g) => drawFlower(g, 16, 58));

  // a pot for it, and a planted version
  canvasTex(scene, "vase", 52, 56, (g) => {
    g.fillStyle = "#0e1424";
    g.beginPath(); g.moveTo(10, 56); g.quadraticCurveTo(4, 34, 14, 22); g.lineTo(38, 22); g.quadraticCurveTo(48, 34, 42, 56); g.closePath(); g.fill();
    g.fillRect(12, 16, 28, 8);
    g.strokeStyle = "rgba(143,179,217,0.55)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(14, 18); g.lineTo(38, 18); g.stroke();
    g.beginPath(); g.moveTo(16, 36); g.lineTo(36, 36); g.stroke();
  });

  // Cornifer's folded map on a small rock
  canvasTex(scene, "map_item", 60, 44, (g) => {
    g.fillStyle = "#101828";
    g.beginPath(); g.ellipse(30, 40, 26, 6, 0, 0, 7); g.fill();
    g.fillStyle = "#e9dcb4";
    g.beginPath(); g.moveTo(8, 36); g.lineTo(16, 12); g.lineTo(30, 18); g.lineTo(44, 10); g.lineTo(52, 34); g.lineTo(30, 40); g.closePath(); g.fill();
    g.strokeStyle = "rgba(120,90,50,0.7)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(16, 12); g.lineTo(18, 37); g.moveTo(30, 18); g.lineTo(30, 40); g.moveTo(44, 10); g.lineTo(42, 36); g.stroke();
    g.strokeStyle = "#a33a2a"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(34, 24); g.lineTo(40, 30); g.moveTo(40, 24); g.lineTo(34, 30); g.stroke();
  });

  // the bank
  canvasTex(scene, "bank", 190, 170, (g) => {
    g.fillStyle = "#121a2e";
    g.fillRect(14, 62, 162, 108);
    g.fillStyle = "#1a2540";
    g.beginPath(); g.moveTo(4, 66); g.lineTo(95, 14); g.lineTo(186, 66); g.closePath(); g.fill();
    g.strokeStyle = "#d9b45f"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(4, 66); g.lineTo(95, 14); g.lineTo(186, 66); g.stroke();
    // pillars
    g.fillStyle = "#26335a";
    for (const x of [24, 62, 118, 156]) g.fillRect(x, 70, 10, 100);
    // door
    g.fillStyle = "#06080f"; g.beginPath(); g.roundRect(78, 104, 34, 66, [14, 14, 0, 0]); g.fill();
    g.strokeStyle = "#d9b45f"; g.lineWidth = 2; g.beginPath(); g.roundRect(78, 104, 34, 66, [14, 14, 0, 0]); g.stroke();
    // sign + coin
    g.fillStyle = "#d9b45f"; g.beginPath(); g.roundRect(54, 74, 82, 22, 4); g.fill();
    g.fillStyle = "#1a1408"; g.font = "bold 15px Georgia, serif"; g.textAlign = "center";
    g.fillText("BANK", 95, 91);
    g.save(); g.shadowColor = "#ffd88a"; g.shadowBlur = 10; g.fillStyle = "#ffd88a";
    g.beginPath(); g.arc(95, 40, 9, 0, 7); g.fill(); g.restore();
    g.fillStyle = "#8a6a20"; g.font = "bold 12px Georgia, serif"; g.fillText("$", 95, 44.5);
  });

  // Millibelle's holiday spot: a striped parasol, a chair, a very relaxed bird
  canvasTex(scene, "millibelle", 150, 150, (g) => {
    // pole
    g.strokeStyle = "#3a2a1a"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(104, 148); g.lineTo(104, 30); g.stroke();
    // parasol
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? "#f1f3fa" : "#e0596b";
      const a0 = Math.PI + (i * Math.PI) / 6, a1 = Math.PI + ((i + 1) * Math.PI) / 6;
      g.beginPath(); g.moveTo(104, 34); g.arc(104, 34, 52, a0, a1); g.closePath(); g.fill();
    }
    // chair
    g.strokeStyle = "#1a2540"; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(26, 146); g.lineTo(46, 108); g.lineTo(88, 108); g.lineTo(100, 146); g.stroke();
    g.beginPath(); g.moveTo(46, 108); g.lineTo(34, 84); g.stroke();
    g.fillStyle = "#34508f"; g.beginPath(); g.roundRect(36, 100, 56, 10, 4); g.fill();
    // the bird
    g.fillStyle = "#3d6dd6"; g.beginPath(); g.ellipse(62, 86, 20, 22, 0, 0, 7); g.fill();
    g.fillStyle = "#6fa0ff"; g.beginPath(); g.ellipse(70, 92, 12, 14, 0, 0, 7); g.fill();
    g.fillStyle = "#3d6dd6"; g.beginPath(); g.arc(56, 58, 16, 0, 7); g.fill();
    g.fillStyle = "#f4c25c"; g.beginPath(); g.moveTo(66, 58); g.lineTo(86, 62); g.lineTo(66, 67); g.closePath(); g.fill();
    // sunglasses
    g.fillStyle = "#05070d";
    g.beginPath(); g.ellipse(52, 55, 6.5, 4.5, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(65, 55, 6.5, 4.5, 0, 0, 7); g.fill();
    g.fillRect(56, 54, 4, 1.8);
    // drink
    g.fillStyle = "rgba(255,150,190,0.85)"; g.beginPath(); g.moveTo(80, 84); g.lineTo(96, 84); g.lineTo(88, 100); g.closePath(); g.fill();
    g.strokeStyle = "#e8f0ff"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(88, 100); g.lineTo(88, 108); g.stroke();
    g.fillStyle = "#e0596b"; g.beginPath(); g.arc(94, 82, 3, 0, 7); g.fill();
  });

  // Quirrel, sitting by the lake with his nail across his lap
  canvasTex(scene, "quirrel", 96, 84, (g) => {
    // cloak
    g.fillStyle = "#6b4f3a";
    g.beginPath(); g.moveTo(24, 80); g.quadraticCurveTo(14, 48, 34, 34); g.lineTo(62, 34); g.quadraticCurveTo(82, 48, 72, 80); g.closePath(); g.fill();
    g.fillStyle = "#8a6a4e"; g.beginPath(); g.moveTo(34, 36); g.lineTo(62, 36); g.lineTo(58, 44); g.lineTo(38, 44); g.closePath(); g.fill();
    // round helmet-head
    g.fillStyle = "#e6dcc6"; g.beginPath(); g.arc(48, 24, 19, 0, 7); g.fill();
    g.strokeStyle = "rgba(60,45,30,0.6)"; g.lineWidth = 1.5; g.beginPath(); g.arc(48, 24, 19, 0, 7); g.stroke();
    g.fillStyle = "#2a1d12"; g.fillRect(31, 22, 34, 6);
    g.fillStyle = "#f6e9b0"; g.beginPath(); g.arc(41, 25, 2, 0, 7); g.arc(55, 25, 2, 0, 7); g.fill();
    // little horn tuft
    g.fillStyle = "#e6dcc6"; g.beginPath(); g.moveTo(44, 6); g.lineTo(48, -2); g.lineTo(52, 6); g.closePath(); g.fill();
    // legs folded + nail across lap
    g.fillStyle = "#4e3826"; g.beginPath(); g.ellipse(48, 78, 30, 7, 0, 0, 7); g.fill();
    g.save(); g.translate(48, 66); g.rotate(-0.12);
    g.fillStyle = "#cfd8ea"; g.beginPath(); g.moveTo(-34, -2); g.lineTo(26, -4); g.lineTo(34, 0); g.lineTo(26, 3); g.lineTo(-34, 3); g.closePath(); g.fill();
    g.fillStyle = "#3a2a1a"; g.fillRect(-40, -3, 10, 7);
    g.restore();
  });

  // lake water (tiles horizontally)
  canvasTex(scene, "lake", 256, 56, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 56);
    gr.addColorStop(0, "#5fa8ff"); gr.addColorStop(0.35, "#2c5fc4"); gr.addColorStop(1, "#0b1a4a");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 56);
    g.strokeStyle = "rgba(220,240,255,0.55)"; g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const y = 8 + i * 9, o = (i * 37) % 64;
      g.beginPath();
      for (let x = -10; x < 270; x += 4) g.lineTo(x, y + Math.sin((x + o) / 9) * 1.6);
      g.stroke();
    }
  });
}

export function makeAllTextures(scene: Phaser.Scene) {
  makeFx(scene);
  makePlayerFrames(scene);
  makeHead(scene);
  makeEnemies(scene);
  makeBosses(scene);
  makeProps(scene);
  makeExtras(scene);
  for (let z = 0; z < 4; z++) bgLayers(scene, z);
}
