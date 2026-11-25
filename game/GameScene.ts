import * as Phaser from "phaser";
import { site } from "@/lib/site";
import { ZONE_PAL, FRAME_COUNT, makeAllTextures } from "./art";
import { audio } from "./audio";
import { bus, HudState } from "./bus";
import { Level, LightDef, FoeDef, ArenaDef, BossId, ZONE_NAMES, buildLevel } from "./level";
import { Save, writeSave } from "./state";

const W = 1280;
const H = 720;
const SPEED = 270;
const JUMP_V = 660;
const GRAV = 1800;

type FoeData = {
  def: FoeDef;
  hp: number;
  dead: boolean;
  stunUntil: number;
  t: number;
  state: string;
  dir: 1 | -1;
  baseY: number;
  nextShot: number;
};
type Foe = Phaser.Physics.Arcade.Sprite & { d: FoeData };

type BossCfg = {
  id: BossId;
  name: string;
  tex: string;
  hp: number;
  bw: number;
  bh: number;
  flying: boolean;
  patterns: string[];
};
const BOSSES: Record<BossId, BossCfg> = {
  warden: { id: "warden", name: "The Warden", tex: "warden", hp: 16, bw: 90, bh: 150, flying: false, patterns: ["charge", "slam"] },
  archivist: { id: "archivist", name: "The Archivist", tex: "archivist", hp: 20, bw: 120, bh: 110, flying: true, patterns: ["fan", "rain", "dive"] },
  unlit: { id: "unlit", name: site.finalBossName, tex: "unlit", hp: 30, bw: 100, bh: 180, flying: false, patterns: ["charge", "slam", "ring"] },
};

type Boss = {
  cfg: BossCfg;
  arena: ArenaDef;
  sprite: Phaser.Physics.Arcade.Sprite | null;
  hp: number;
  max: number;
  active: boolean;
  state: string;
  t: number;
  dir: 1 | -1;
  idx: number;
  doors: Phaser.GameObjects.Zone[];
  airSince: number;
  phase2: boolean;
  home: { x: number; y: number };
  collider?: Phaser.Physics.Arcade.Collider;
};

type LightObj = {
  def: LightDef;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  lit: boolean;
  nextEmber: number;
};

const approach = (v: number, t: number, d: number) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class GameScene extends Phaser.Scene {
  S!: Save;
  L!: Level;
  startPaused = true;

  player!: Phaser.Physics.Arcade.Sprite;
  head!: Phaser.GameObjects.Image;
  pGlow!: Phaser.GameObjects.Image;
  plats!: Phaser.Physics.Arcade.StaticGroup;
  groundFoes!: Phaser.Physics.Arcade.Group;
  airFoes!: Phaser.Physics.Arcade.Group;
  hostiles!: Phaser.Physics.Arcade.Group;
  foes: Foe[] = [];
  bosses: Boss[] = [];
  lanterns: LightObj[] = [];
  wispObjs: { id: string; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
  emberGroup!: Phaser.Physics.Arcade.Group;
  signTexts: Phaser.GameObjects.Text[] = [];
  tabletObjs: { id: string; x: number; y: number; text: string }[] = [];
  benchObjs: { id: string; x: number; y: number }[] = [];
  altarObjs: { def: Level["altars"][number]; img: Phaser.GameObjects.Image; orb: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
  hazards: Phaser.Geom.Rectangle[] = [];

  keys!: Record<"left" | "right" | "jump" | "atk" | "dash" | "use", Phaser.Input.Keyboard.Key[]>;
  clickAtk = false;

  hp = 5;
  maxHp = 5;
  now = 0;
  dead = false;
  frozen = false;
  facing: 1 | -1 = 1;
  lastGround = 0;
  lastWall = -999;
  lastWallDir = 0;
  jumpBuf = 0;
  airJumps = 0;
  dashReady = true;
  dashing = false;
  dashEnd = 0;
  dashCd = 0;
  lastAfter = 0;
  lockUntil = 0;
  invulnUntil = 0;
  hurtAnimUntil = 0;
  atkCd = 0;
  atkUntil = 0;
  atkHit = new Set<unknown>();
  wasGround = true;
  lastVy = 0;
  restUntil = 0;
  lastSafe = { x: 0, y: 0 };
  timerUntil = 0;
  zone = 0;
  hint: string | null = null;
  hudDirty = true;
  lastHudAt = 0;
  readHint = 0;

  bgFar: Phaser.GameObjects.TileSprite[] = [];
  bgMid: Phaser.GameObjects.TileSprite[] = [];
  bgNear: Phaser.GameObjects.TileSprite[] = [];
  fogImg!: Phaser.GameObjects.Image;
  zoneEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  burstEmber!: Phaser.GameObjects.Particles.ParticleEmitter;
  burstWhite!: Phaser.GameObjects.Particles.ParticleEmitter;
  burstDark!: Phaser.GameObjects.Particles.ParticleEmitter;
  offs: (() => void)[] = [];

  constructor() {
    super("Game");
  }

  init(data: { save: Save }) {
    this.S = data.save;
  }

  preload() {
    this.load.image("face_src", site.facePath);
    this.load.on("loaderror", () => {
      /* no photo yet: head falls back to the empty placeholder */
    });
  }

  /* ============================== CREATE ============================== */
  create() {
    this.L = buildLevel();
    makeAllTextures(this);

    const bnd = this.L.bounds();
    this.physics.world.setBounds(0, bnd.minY - 1200, bnd.maxX, bnd.maxY - bnd.minY + 2600);
    this.physics.world.gravity.y = GRAV;
    this.cameras.main.setBounds(0, bnd.minY - 500, bnd.maxX, bnd.maxY - bnd.minY + 700);
    this.cameras.main.setBackgroundColor(ZONE_PAL[0].top);

    this.maxHp = this.S.easy ? 8 : 5;
    this.hp = this.maxHp;

    this.buildBackground();
    this.buildPlatforms();
    this.buildProps();
    this.buildPlayer();
    this.buildFx();
    this.buildBosses();
    this.groundFoes = this.physics.add.group();
    this.airFoes = this.physics.add.group();
    this.emberGroup = this.physics.add.group();
    this.spawnFoes();
    this.setupInput();

    this.physics.add.collider(this.player, this.plats);
    this.physics.add.collider(this.groundFoes, this.plats);
    this.physics.add.collider(this.airFoes, this.plats);
    this.physics.add.collider(this.emberGroup, this.plats);

    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.09, 0.09);
    cam.setDeadzone(60, 50);

    // start at the saved bench
    const bench = this.L.benches.find((b) => b.id === this.S.bench) ?? this.L.benches[0];
    this.player.setPosition(bench.x + 40, bench.y - 2);
    this.lastSafe = { x: bench.x + 40, y: bench.y - 2 };
    cam.centerOn(this.player.x, this.player.y - 100);
    this.zone = this.zoneAt(this.player.x);
    this.zoneEmitters.forEach((e, i) => (e.emitting = i === this.zone));
    this.fogImg.setTint(ZONE_PAL[this.zone].mist);
    audio.setMuted(this.S.muted);
    audio.setZone(this.zone);

    this.offs.push(
      bus.on("pause", () => this.scene.pause()),
      bus.on("resume", () => {
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        this.clickAtk = false;
        this.jumpBuf = 0;
      }),
      bus.on("skip-all", () => this.skipAll()),
      bus.on("mute", (m: boolean) => {
        this.S.muted = m;
        audio.setMuted(m);
        writeSave(this.S);
      }),
      bus.on("easy", (e: boolean) => {
        this.S.easy = e;
        writeSave(this.S);
      }),
      bus.on("request-hud", () => this.emitHud())
    );
    this.events.once("shutdown", () => this.offs.forEach((f) => f()));
    this.events.once("destroy", () => this.offs.forEach((f) => f()));

    if (process.env.NODE_ENV !== "production" && typeof location !== "undefined" && location.search.includes("dev")) {
      (window as any).__lantern = this;
    }

    this.emitHud();
    bus.emit("ready");
    this.time.delayedCall(700, () => bus.emit("zone", this.zone, ZONE_NAMES[this.zone]));
    if (this.startPaused) this.scene.pause();
  }

  /* ============================== BUILD ============================== */
  buildBackground() {
    const mk = (z: number, l: number, depth: number) =>
      this.add.tileSprite(0, 0, W, H, `bg_${z}_${l}`).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    for (let z = 0; z < 4; z++) {
      this.bgFar.push(mk(z, 0, -300 + z));
      this.bgMid.push(mk(z, 1, -250 + z));
      this.bgNear.push(mk(z, 2, 20 + z));
    }
    this.fogImg = this.add.image(0, H, "fog").setOrigin(0, 1).setScrollFactor(0).setDepth(19).setAlpha(0.35);
    this.bgNear.forEach((n) => n.setAlpha(0.0));
  }

  buildPlatforms() {
    this.plats = this.physics.add.staticGroup();
    for (const p of this.L.plats) {
      const z = this.add.zone(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h);
      this.plats.add(z);
      this.add.tileSprite(p.x, p.y, p.w, p.h, `rock_${p.zone}`).setOrigin(0, 0).setDepth(1);
      // shade under the rim for depth
      this.add.rectangle(p.x, p.y, p.w, Math.min(p.h, 70), 0x000000, 0.28).setOrigin(0, 0).setDepth(1.1);
      this.add.tileSprite(p.x, p.y - 9, p.w, 14, `rim_${p.zone}`).setOrigin(0, 0).setDepth(1.2);
    }
    this.plats.refresh();
  }

  buildProps() {
    const L = this.L;
    for (const h of L.hazards) {
      this.add.tileSprite(h.x, h.y - 26, h.w, 26, "spikes").setOrigin(0, 0).setDepth(2);
      this.hazards.push(new Phaser.Geom.Rectangle(h.x + 4, h.y - 20, h.w - 8, 20));
    }
    for (const b of L.benches) {
      this.add.image(b.x, b.y, "bench").setOrigin(0.5, 1).setDepth(2);
      this.add.image(b.x - 34, b.y - 48, "glow").setTint(0xffc880).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.35).setDepth(2);
      this.benchObjs.push({ id: b.id, x: b.x, y: b.y });
    }
    for (const t of L.tablets) {
      this.add.image(t.x, t.y, "tablet").setOrigin(0.5, 1).setDepth(2);
      this.tabletObjs.push({ id: t.id, x: t.x, y: t.y, text: t.text });
    }
    for (const p of L.plates) {
      this.add.image(p.x, p.y + 2, "rune").setOrigin(0.5, 1).setDepth(2);
    }
    for (const s of L.signs) {
      const txt = this.add
        .text(s.x, s.y - 150, s.text, {
          fontFamily: "Georgia, serif",
          fontSize: "22px",
          fontStyle: "italic",
          color: "#c3d1e8",
          stroke: "#02040a",
          strokeThickness: 5,
          align: "center",
          wordWrap: { width: 460 },
        })
        .setOrigin(0.5, 1)
        .setDepth(3)
        .setAlpha(0);
      this.signTexts.push(txt);
    }
    for (const a of L.altars) {
      const img = this.add.image(a.x, a.y, "altar").setOrigin(0.5, 1).setDepth(2);
      const orb = this.add.image(a.x, a.y - 130, "wisp").setDepth(3).setTint(0xffd9a0).setScale(1.3);
      const glow = this.add.image(a.x, a.y - 130, "glow").setTint(0xffc070).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setAlpha(0.5).setDepth(2);
      const got = this.S.abilities[a.ability];
      if (got) { orb.setVisible(false); glow.setVisible(false); }
      this.tweens.add({ targets: [orb, glow], y: a.y - 142, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.altarObjs.push({ def: a, img, orb, glow });
    }
    for (const w of L.wisps) {
      if (this.S.wisps.includes(w.id)) continue;
      const glow = this.add.image(w.x, w.y, "glow").setTint(0x8ec8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.38).setAlpha(0.5).setDepth(3);
      const img = this.add.image(w.x, w.y, "wisp").setDepth(3).setScale(0.8);
      this.tweens.add({ targets: [img, glow], y: w.y - 10, duration: 1100 + Math.random() * 700, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: Math.random() * 800 });
      this.wispObjs.push({ id: w.id, img, glow });
    }
    for (const l of L.lights) {
      const lit = this.S.lit.includes(l.slot);
      const sprite = this.add.image(l.x, l.y, lit ? "lantern_on" : "lantern_off").setOrigin(0.5, 1).setDepth(2);
      const glow = this.add
        .image(l.x, l.y - 118, "glow")
        .setTint(lit ? 0xffc070 : 0x5a6a88)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(lit ? 2.4 : 0.9)
        .setAlpha(lit ? 0.5 : 0.18)
        .setDepth(2);
      this.lanterns.push({ def: l, sprite, glow, lit, nextEmber: 0 });
    }
  }

  buildPlayer() {
    this.player = this.physics.add.sprite(0, 0, "pl_idle_0").setOrigin(0.5, 1).setDepth(6);
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.setSize(22, 76).setOffset(21, -12);
    b.setMaxVelocityY(950);
    this.player.setCollideWorldBounds(true);
    this.head = this.add.image(0, 0, "head").setDisplaySize(50, 50).setDepth(6.5);
    this.pGlow = this.add.image(0, 0, "glow").setTint(0xffc070).setBlendMode(Phaser.BlendModes.ADD).setScale(1.5).setAlpha(0.4).setDepth(5);
  }

  buildFx() {
    const mkBurst = (tint: number, grav = 300) =>
      this.add.particles(0, 0, "dot", {
        emitting: false,
        lifespan: { min: 300, max: 750 },
        speed: { min: 60, max: 280 },
        scale: { start: 1.4, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: grav,
        tint,
        blendMode: "ADD",
      }).setDepth(9);
    this.burstEmber = mkBurst(0xffd9a0);
    this.burstWhite = mkBurst(0xe8f0ff, 400);
    this.burstDark = mkBurst(0xb9a9c9, 200);

    // ambient motes for each zone, fixed to the camera
    ZONE_PAL.forEach((pal, z) => {
      const e = this.add.particles(0, 0, "dot", {
        emitZone: { type: "random", source: new Phaser.Geom.Rectangle(0, 0, W, H) } as any,
        lifespan: 7000,
        speedY: { min: z === 3 ? -40 : z === 1 ? -14 : -10, max: z === 3 ? -90 : z === 1 ? 14 : 10 },
        speedX: { min: -16, max: 16 },
        scale: { start: 0.45, end: 0.1 },
        alpha: { values: [0, 0.7, 0] },
        frequency: 120,
        quantity: 1,
        tint: pal.tint,
        blendMode: "ADD",
      })
        .setScrollFactor(0)
        .setDepth(18);
      e.emitting = z === this.zone;
      this.zoneEmitters.push(e);
    });
  }

  buildBosses() {
    this.hostiles = this.physics.add.group({ allowGravity: false });
    for (const a of this.L.arenas) {
      const cfg = BOSSES[a.boss];
      const hpMul = this.S.easy ? 0.7 : 1;
      this.bosses.push({
        cfg,
        arena: a,
        sprite: null,
        hp: Math.round(cfg.hp * hpMul),
        max: Math.round(cfg.hp * hpMul),
        active: false,
        state: "idle",
        t: 0,
        dir: -1,
        idx: 0,
        doors: [],
        airSince: 0,
        phase2: false,
        home: { x: a.x0 + (a.x1 - a.x0) * 0.72, y: a.y },
      });
    }
  }

  spawnFoes() {
    this.foes = [];
    this.groundFoes.clear(true, true);
    this.airFoes.clear(true, true);
    for (const def of this.L.foes) {
      const air = def.type === "flyer";
      const key = def.type === "crawler" ? "crawler_0" : def.type === "flyer" ? "flyer_0" : def.type;
      const s = (air ? this.airFoes : this.groundFoes).create(def.x, def.y, key) as unknown as Foe;
      s.setOrigin(0.5, 1).setDepth(5);
      const b = s.body as Phaser.Physics.Arcade.Body;
      const hp = def.type === "crawler" ? 2 : def.type === "flyer" ? 2 : def.type === "spitter" ? 3 : 4;
      if (def.type === "crawler") b.setSize(46, 26).setOffset(5, 10);
      else if (def.type === "flyer") { b.setSize(32, 34).setOffset(16, 18); s.setOrigin(0.5, 0.5); }
      else if (def.type === "spitter") b.setSize(28, 60).setOffset(10, 12);
      else b.setSize(70, 44).setOffset(7, 12);
      b.allowGravity = !air && def.type !== "spitter" ? true : false;
      if (def.type === "spitter") b.setImmovable(true);
      s.d = { def, hp, dead: false, stunUntil: 0, t: Math.random() * 3, state: "patrol", dir: def.face, baseY: def.y, nextShot: 0 };
      if (def.type === "flyer") s.setPosition(def.x, def.y);
      this.foes.push(s);
    }
  }

  setupInput() {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const mk = (codes: number[]) => codes.map((c) => kb.addKey(c, true));
    this.keys = {
      left: mk([K.LEFT, K.A]),
      right: mk([K.RIGHT, K.D]),
      jump: mk([K.SPACE, K.UP, K.W]),
      atk: mk([K.J, K.Z, K.X]),
      dash: mk([K.K, K.C, K.SHIFT]),
      use: mk([K.E, K.DOWN, K.S]),
    };
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) this.clickAtk = true;
    });
  }

  /* ============================== HELPERS ============================== */
  zoneAt(x: number) {
    let z = 0;
    for (let i = 1; i < 4; i++) if (x >= this.L.zoneStarts[i]) z = i;
    return z;
  }
  down(k: Phaser.Input.Keyboard.Key[]) {
    return k.some((x) => x.isDown);
  }
  just(k: Phaser.Input.Keyboard.Key[]) {
    let r = false;
    for (const x of k) if (Phaser.Input.Keyboard.JustDown(x)) r = true;
    return r;
  }
  get invuln() {
    return this.now < this.invulnUntil || this.dashing;
  }
  save() {
    writeSave(this.S);
  }
  toast(text: string, big = false) {
    bus.emit("toast", text, big);
  }
  setHint(h: string | null) {
    if (h !== this.hint) {
      this.hint = h;
      bus.emit("hint", h);
    }
  }
  emitHud() {
    const boss = this.bosses.find((b) => b.active && b.sprite);
    const st: HudState = {
      hp: this.hp,
      maxHp: this.maxHp,
      lit: [...this.S.lit],
      wisps: this.S.wisps.length,
      kills: this.S.kills,
      zone: this.zone,
      abilities: { ...this.S.abilities },
      boss: boss ? { name: boss.cfg.name, hp: boss.hp, max: boss.max } : null,
      timer: this.timerUntil > this.now ? Math.ceil((this.timerUntil - this.now) / 1000) : 0,
      tablets: this.S.tablets.length,
    };
    bus.emit("state", st);
  }
  overlap(a: Phaser.Physics.Arcade.Body, b: Phaser.Physics.Arcade.Body, pad = 0) {
    return a.right - pad > b.left && a.left + pad < b.right && a.bottom - pad > b.top && a.top + pad < b.bottom;
  }
  burst(x: number, y: number, n: number, which: "ember" | "white" | "dark" = "ember") {
    const e = which === "ember" ? this.burstEmber : which === "white" ? this.burstWhite : this.burstDark;
    e.explode(n, x, y);
  }

  /* ============================== UPDATE ============================== */
  update(time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.now = time;
    this.updateWorld(time);
    if (this.dead || this.frozen || time < this.restUntil) {
      const b = this.player.body as Phaser.Physics.Arcade.Body;
      if (!this.dead) b.setVelocityX(approach(b.velocity.x, 0, 2400 * dt));
      this.syncPlayerVisual(time, 0, true);
      return;
    }
    this.updatePlayer(time, dt);
    this.updateFoes(time, dt);
    this.updateBosses(time, dt);
    this.updateHostiles(time);
    this.updateInteractions(time);
    if (time - this.lastHudAt > 100 && this.timerUntil > 0) {
      this.lastHudAt = time;
      this.emitHud();
      if (time > this.timerUntil) this.timerUntil = 0;
    }
  }

  updateWorld(time: number) {
    const cam = this.cameras.main;
    const px = this.player.x;
    const blend = (z: number) => (z <= 0 ? 1 : clamp((px - (this.L.zoneStarts[z] - 650)) / 900, 0, 1));
    const yOff = clamp(cam.scrollY * 0.02, -30, 30);
    for (let z = 0; z < 4; z++) {
      const a = blend(z);
      const out = z < 3 ? 1 - blend(z + 1) : 1;
      this.bgFar[z].setAlpha(z === 0 ? 1 : a);
      this.bgMid[z].setAlpha(a * out);
      this.bgNear[z].setAlpha(0.9 * a * out);
      this.bgFar[z].tilePositionX = cam.scrollX * 0.08;
      this.bgFar[z].tilePositionY = yOff * 0.3;
      this.bgMid[z].tilePositionX = cam.scrollX * 0.26;
      this.bgMid[z].tilePositionY = yOff;
      this.bgNear[z].tilePositionX = cam.scrollX * 0.7;
      this.bgNear[z].tilePositionY = yOff * 1.5;
    }
    const zNow = this.zoneAt(px);
    if (zNow !== this.zone) {
      this.zone = zNow;
      this.zoneEmitters.forEach((e, i) => (e.emitting = i === zNow));
      this.fogImg.setTint(ZONE_PAL[zNow].mist);
      audio.setZone(zNow);
      bus.emit("zone", zNow, ZONE_NAMES[zNow]);
      this.emitHud();
    }
    // lights flicker + embers
    for (const l of this.lanterns) {
      if (l.lit) {
        l.glow.setScale(2.4 + Math.sin(time / 170 + l.def.slot) * 0.08).setAlpha(0.46 + Math.sin(time / 230 + l.def.slot) * 0.05);
        if (time > l.nextEmber && Math.abs(l.def.x - px) < 900) {
          l.nextEmber = time + 500 + Math.random() * 500;
          this.burstEmber.explode(1, l.def.x + (Math.random() - 0.5) * 16, l.def.y - 110);
        }
      }
    }
    for (const s of this.signTexts) {
      const d = Math.abs(s.x - px);
      s.setAlpha(clamp((520 - d) / 220, 0, 1) * 0.95);
    }
    this.pGlow.setScale(1.45 + Math.sin(time / 140) * 0.06);
  }

  /* ----------------------------- player ----------------------------- */
  updatePlayer(time: number, dt: number) {
    const p = this.player;
    const b = p.body as Phaser.Physics.Arcade.Body;
    const A = this.S.abilities;

    const B = this.bot;
    const left = B ? B.dir < 0 : this.down(this.keys.left);
    const right = B ? B.dir > 0 : this.down(this.keys.right);
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const jumpHeld = B ? B.jump : this.down(this.keys.jump);
    if (B ? B.jumpJust : this.just(this.keys.jump)) this.jumpBuf = time + 140;
    const dashJust = B ? B.dashJust : this.just(this.keys.dash);
    const atkJust = B ? B.atkJust : this.just(this.keys.atk) || this.clickAtk;
    this.clickAtk = false;
    if (B) { B.jumpJust = false; B.dashJust = false; B.atkJust = false; }

    const onGround = b.blocked.down || b.touching.down;
    if (onGround) {
      this.lastGround = time;
      this.airJumps = A.double ? 1 : 0;
      this.dashReady = true;
      if (!this.wasGround && this.lastVy > 420) {
        audio.sfx("land");
        this.burst(p.x, p.y, 4, "white");
      }
      this.recordSafe();
    }
    this.wasGround = onGround;
    this.lastVy = b.velocity.y;

    const wallDir = b.blocked.left ? -1 : b.blocked.right ? 1 : 0;
    const clinging = A.wall && !onGround && wallDir !== 0 && dir === wallDir && time > this.lockUntil && b.velocity.y > -60 && !this.dashing;
    if (clinging) {
      this.lastWall = time;
      this.lastWallDir = wallDir;
      this.dashReady = true;
      this.airJumps = A.double ? 1 : 0;
      if (b.velocity.y > 85) b.setVelocityY(85);
    }

    // jump
    if (time < this.jumpBuf) {
      if (time - this.lastGround < 110) {
        b.setVelocityY(-JUMP_V);
        this.jumpBuf = 0;
        this.lastGround = -999;
        audio.sfx("jump");
        this.burst(p.x, p.y, 3, "white");
      } else if (A.wall && time - this.lastWall < 120) {
        b.setVelocity(-this.lastWallDir * 270, -650);
        this.lockUntil = time + 170;
        this.facing = (-this.lastWallDir) as 1 | -1;
        this.jumpBuf = 0;
        this.lastWall = -999;
        audio.sfx("jump");
        this.burst(p.x + this.lastWallDir * 12, p.y - 30, 4, "white");
      } else if (this.airJumps > 0 && time - this.lastGround >= 110) {
        b.setVelocityY(-620);
        this.airJumps--;
        this.jumpBuf = 0;
        audio.sfx("jump");
        this.burst(p.x, p.y, 8, "white");
      }
    }
    if (!jumpHeld && b.velocity.y < -250 && time > this.lockUntil) b.setVelocityY(-250);

    // dash
    if (dashJust && A.dash && this.dashReady && time > this.dashCd && !this.dashing) {
      this.dashing = true;
      this.dashEnd = time + 235;
      this.dashCd = time + 520;
      this.dashReady = false;
      b.allowGravity = false;
      b.setVelocityY(0);
      audio.sfx("dash");
      if (dir !== 0) this.facing = dir as 1 | -1;
    }
    if (this.dashing) {
      b.setVelocity(this.facing * 880, 0);
      if (time - this.lastAfter > 35) {
        this.lastAfter = time;
        const ghost = this.add.image(p.x, p.y, p.texture.key).setOrigin(0.5, 1).setFlipX(this.facing < 0).setTint(0x8fb3d9).setAlpha(0.5).setDepth(5);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
      }
      if (time > this.dashEnd) {
        this.dashing = false;
        b.allowGravity = true;
        b.setVelocityX(this.facing * SPEED);
      }
    }

    // run
    if (!this.dashing) {
      if (time < this.lockUntil) {
        /* wall-kick / knockback in flight */
      } else {
        const target = dir * SPEED;
        const acc = onGround ? 3400 : 2600;
        b.setVelocityX(approach(b.velocity.x, target, (dir === 0 && onGround ? 4200 : acc) * dt));
        if (dir !== 0) this.facing = dir as 1 | -1;
      }
    }

    // attack
    if (atkJust && time > this.atkCd && !this.dashing) {
      this.atkCd = time + 360;
      this.atkUntil = time + 150;
      this.atkHit.clear();
      audio.sfx("slash");
      const sl = this.add.image(p.x + this.facing * 56, p.y - 42, "slash").setFlipX(this.facing < 0).setDepth(8).setAlpha(0.95);
      this.tweens.add({ targets: sl, alpha: 0, scaleX: 1.25, scaleY: 1.1, duration: 170, onComplete: () => sl.destroy() });
    }
    if (time < this.atkUntil) this.checkSlash();

    // hazards & pits
    for (const r of this.hazards) {
      if (Phaser.Geom.Rectangle.Overlaps(r, new Phaser.Geom.Rectangle(b.left, b.top, b.width, b.height))) {
        this.hazardHit();
        break;
      }
    }
    const bnd = this.L.bounds();
    if (p.y > bnd.maxY + 500) this.hazardHit();

    this.syncPlayerVisual(time, dir, onGround, clinging);
  }

  recordSafe() {
    const p = this.player;
    let best: (typeof this.L.plats)[number] | null = null;
    for (const pl of this.L.plats) {
      if (p.x >= pl.x && p.x <= pl.x + pl.w && Math.abs(p.y - pl.y) < 6) { best = pl; break; }
    }
    if (!best || best.w < 160) return;
    if (this.L.hazards.some((h) => Math.abs(h.y - best!.y) < 2 && p.x > h.x - 60 && p.x < h.x + h.w + 60)) return;
    const inset = 70;
    if (p.x > best.x + inset && p.x < best.x + best.w - inset) this.lastSafe = { x: p.x, y: p.y - 2 };
  }

  syncPlayerVisual(time: number, dir: number, onGround: boolean, clinging = false) {
    const p = this.player;
    const b = p.body as Phaser.Physics.Arcade.Body;
    let pose = "idle";
    let frame = Math.floor(time / 520) % 2;
    if (this.dead || time < this.hurtAnimUntil) { pose = "hurt"; frame = 0; }
    else if (this.dashing) { pose = "dash"; frame = 0; }
    else if (time < this.atkUntil) { pose = "attack"; frame = 0; }
    else if (clinging) { pose = "cling"; frame = 0; }
    else if (!onGround) { pose = b.velocity.y < 0 ? "jump" : "fall"; frame = 0; }
    else if (Math.abs(b.velocity.x) > 40) { pose = "run"; frame = Math.floor(time / 70) % FRAME_COUNT.run; }
    const key = `pl_${pose}_${frame}`;
    if (p.texture.key !== key) p.setTexture(key);
    p.setFlipX(this.facing < 0);
    const blink = time < this.invulnUntil && Math.floor(time / 70) % 2 === 0;
    p.setAlpha(blink ? 0.35 : 1);
    // head rides on top of the cloak
    const bob = pose === "run" ? Math.abs(Math.sin(time / 110)) * -3 : pose === "idle" ? Math.sin(time / 520) * 1.4 : 0;
    const lean = pose === "dash" ? this.facing * 8 : pose === "run" ? this.facing * 3 : clinging ? -this.facing * 4 : 0;
    this.head.setPosition(p.x + lean, p.y - 68 + bob + (pose === "fall" ? 2 : 0));
    this.head.setAngle(clamp(b.velocity.x * 0.012, -6, 6) + (pose === "hurt" ? -this.facing * 10 : 0));
    this.head.setAlpha(blink ? 0.35 : 1);
    this.pGlow.setPosition(p.x + this.facing * 24 + (pose === "run" ? this.facing * 4 : 0), p.y - 22);
    if (this.dead) this.head.setAlpha(0.5);
    void dir;
  }

  checkSlash() {
    const p = this.player;
    const r = new Phaser.Geom.Rectangle(this.facing > 0 ? p.x + 2 : p.x - 126, p.y - 104, 124, 112);
    for (const f of this.foes) {
      if (f.d.dead || this.atkHit.has(f)) continue;
      const fb = f.body as Phaser.Physics.Arcade.Body;
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, new Phaser.Geom.Rectangle(fb.left, fb.top, fb.width, fb.height))) {
        this.atkHit.add(f);
        this.hitFoe(f);
      }
    }
    for (const bs of this.bosses) {
      if (!bs.active || !bs.sprite || this.atkHit.has(bs)) continue;
      const bb = bs.sprite.body as Phaser.Physics.Arcade.Body;
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, new Phaser.Geom.Rectangle(bb.left, bb.top, bb.width, bb.height))) {
        this.atkHit.add(bs);
        this.hitBoss(bs);
      }
    }
  }

  hurt(srcX: number, dmg = 1) {
    if (this.invuln || this.dead) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invulnUntil = this.now + 1200;
    this.hurtAnimUntil = this.now + 260;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    const away = this.player.x < srcX ? -1 : 1;
    b.setVelocity(away * 330, -300);
    this.lockUntil = this.now + 260;
    if (this.dashing) { this.dashing = false; b.allowGravity = true; }
    this.cameras.main.shake(180, 0.008);
    this.cameras.main.flash(120, 255, 90, 90, true);
    audio.sfx("hurt");
    this.burst(this.player.x, this.player.y - 40, 10, "dark");
    this.emitHud();
    if (this.hp <= 0) this.die();
  }

  hazardHit() {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - 1);
    audio.sfx("hurt");
    this.cameras.main.flash(160, 0, 0, 0);
    this.emitHud();
    if (this.hp <= 0) return this.die();
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(0, 0);
    this.player.setPosition(this.lastSafe.x, this.lastSafe.y);
    this.invulnUntil = this.now + 900;
    this.dashing = false;
    b.allowGravity = true;
  }

  die() {
    this.dead = true;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(0, -200);
    b.allowGravity = true;
    this.dashing = false;
    audio.sfx("hurt");
    this.toast("The dark lets go of you.");
    this.cameras.main.fadeOut(900, 2, 3, 8);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.respawn();
      this.cameras.main.fadeIn(700, 2, 3, 8);
    });
  }

  respawn() {
    const bench = this.L.benches.find((x) => x.id === this.S.bench) ?? this.L.benches[0];
    this.hp = this.maxHp;
    this.dead = false;
    this.player.setPosition(bench.x + 40, bench.y - 2);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.lastSafe = { x: bench.x + 40, y: bench.y - 2 };
    this.invulnUntil = this.now + 1000;
    this.timerUntil = 0;
    this.resetWorldCombat();
    this.cameras.main.centerOn(this.player.x, this.player.y - 100);
    this.setHint(null);
    this.emitHud();
  }

  resetWorldCombat() {
    this.spawnFoes();
    this.hostiles.clear(true, true);
    for (const bs of this.bosses) this.resetBoss(bs);
    bus.emit("music", 0);
    audio.setTension(0);
  }

  /* ----------------------------- foes ----------------------------- */
  hitFoe(f: Foe) {
    const d = f.d;
    d.hp -= 1;
    audio.sfx("hit");
    this.burst(f.x, f.y - (f.originY === 0.5 ? 0 : 20), 6, "white");
    this.cameras.main.shake(70, 0.004);
    d.stunUntil = this.now + 180;
    const away = f.x < this.player.x ? -1 : 1;
    (f.body as Phaser.Physics.Arcade.Body).setVelocity(away * 230, d.def.type === "flyer" ? -80 : -120);
    f.setTint(0xffffff);
    this.time.delayedCall(80, () => f.active && f.clearTint());
    // recoil nudge for the player
    if (d.hp <= 0) this.killFoe(f);
  }

  killFoe(f: Foe) {
    f.d.dead = true;
    this.S.kills++;
    audio.sfx("kill");
    this.burst(f.x, f.y - 20, 14, "dark");
    this.burst(f.x, f.y - 20, 6, "white");
    if (this.hp < this.maxHp && Math.random() < 0.28) this.dropEmber(f.x, f.y - 20);
    f.destroy();
    this.save();
    this.emitHud();
  }

  dropEmber(x: number, y: number) {
    const e = this.emberGroup.create(x, y, "ember") as Phaser.Physics.Arcade.Sprite;
    e.setDepth(5);
    e.setVelocity((Math.random() - 0.5) * 160, -260);
    (e.body as Phaser.Physics.Arcade.Body).setBounce(0.3);
    this.time.delayedCall(14000, () => e.active && e.destroy());
  }

  updateFoes(time: number, dt: number) {
    const p = this.player;
    const pb = p.body as Phaser.Physics.Arcade.Body;
    for (const f of this.foes) {
      if (!f.active || f.d.dead) continue;
      const d = f.d;
      const b = f.body as Phaser.Physics.Arcade.Body;
      const dx = p.x - f.x;
      if (Math.abs(dx) > 1500) { if (d.def.type !== "flyer") b.setVelocityX(0); continue; }
      const stunned = time < d.stunUntil;
      switch (d.def.type) {
        case "crawler": {
          f.setTexture(`crawler_${Math.floor(time / 180) % 2}`);
          if (!stunned) {
            if (f.x <= d.def.min) d.dir = 1;
            else if (f.x >= d.def.max) d.dir = -1;
            else if (b.blocked.left) d.dir = 1;
            else if (b.blocked.right) d.dir = -1;
            b.setVelocityX(d.dir * 78);
          }
          f.setFlipX(d.dir < 0);
          break;
        }
        case "flyer": {
          f.setTexture(`flyer_${Math.floor(time / 120) % 2}`);
          if (!stunned) {
            const near = Math.hypot(dx, p.y - 40 - f.y) < 440;
            const tx = near ? p.x : d.def.x + Math.sin(time / 900 + d.t) * 90;
            const ty = near ? p.y - 70 + Math.sin(time / 260 + d.t) * 36 : d.baseY + Math.sin(time / 700 + d.t) * 24;
            const vx = clamp((tx - f.x) * 1.4, -150, 150);
            const vy = clamp((ty - f.y) * 1.4, -140, 140);
            b.setVelocity(approach(b.velocity.x, vx, 600 * dt), approach(b.velocity.y, vy, 600 * dt));
          }
          f.setFlipX(dx < 0);
          break;
        }
        case "spitter": {
          f.setFlipX(dx < 0);
          if (Math.abs(dx) < 620 && Math.abs(p.y - f.y) < 420 && time > d.nextShot) {
            d.nextShot = time + 2300;
            f.setScale(1.15, 0.9);
            this.tweens.add({ targets: f, scaleX: 1, scaleY: 1, duration: 220 });
            this.fireBolt(f.x, f.y - 50, p.x, p.y - 40, 250);
          }
          break;
        }
        case "charger": {
          const aligned = Math.abs(p.y - f.y) < 110 && Math.abs(dx) < 460;
          if (d.state === "patrol" && !stunned) {
            if (f.x <= d.def.min) d.dir = 1;
            else if (f.x >= d.def.max) d.dir = -1;
            b.setVelocityX(d.dir * 55);
            if (aligned && Math.sign(dx) === d.dir && time > d.t) { d.state = "tele"; d.t = time + 520; b.setVelocityX(0); f.setTint(0xffb0a0); }
          } else if (d.state === "tele") {
            f.x += Math.sin(time / 25) * 0.7;
            if (time > d.t) { d.state = "charge"; d.t = time + 800; f.clearTint(); d.dir = dx > 0 ? 1 : -1; }
          } else if (d.state === "charge") {
            b.setVelocityX(d.dir * 470);
            if (time > d.t || b.blocked.left || b.blocked.right) { d.state = "rest"; d.t = time + 900; b.setVelocityX(0); }
          } else if (d.state === "rest") {
            if (time > d.t) { d.state = "patrol"; d.t = time + 1500; }
          }
          f.setFlipX(d.dir < 0);
          if (stunned) d.state = d.state === "tele" ? "patrol" : d.state;
          break;
        }
      }
      if (!this.invuln && this.overlap(pb, b, 6)) this.hurt(f.x);
    }
    // ember pickups
    for (const e of this.emberGroup.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!e.active) continue;
      if (Math.abs(e.x - p.x) < 36 && Math.abs(e.y - (p.y - 30)) < 50) {
        e.destroy();
        if (this.hp < this.maxHp) { this.hp++; audio.sfx("wisp"); this.emitHud(); }
      }
    }
  }

  fireBolt(x: number, y: number, tx: number, ty: number, speed: number) {
    const bolt = this.hostiles.create(x, y, "bolt") as Phaser.Physics.Arcade.Sprite;
    bolt.setDepth(6);
    const a = Math.atan2(ty - y, tx - x);
    (bolt.body as Phaser.Physics.Arcade.Body).setCircle(7, 4, 4).setAllowGravity(false);
    bolt.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    bolt.setData("kind", "bolt").setData("die", this.now + 4200);
    return bolt;
  }

  fireBoltAngle(x: number, y: number, a: number, speed: number) {
    const bolt = this.hostiles.create(x, y, "bolt") as Phaser.Physics.Arcade.Sprite;
    bolt.setDepth(6);
    (bolt.body as Phaser.Physics.Arcade.Body).setCircle(7, 4, 4).setAllowGravity(false);
    bolt.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    bolt.setData("kind", "bolt").setData("die", this.now + 4200);
    return bolt;
  }

  updateHostiles(time: number) {
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    (this.hostiles.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach((h) => {
      if (!h.active) return;
      if (time > (h.getData("die") ?? 0)) return h.destroy();
      const hb = h.body as Phaser.Physics.Arcade.Body;
      if (h.getData("kind") === "bolt") {
        // bolts vanish on solid ground
        for (const pl of this.L.plats) {
          if (h.x > pl.x && h.x < pl.x + pl.w && h.y > pl.y && h.y < pl.y + pl.h) { this.burst(h.x, h.y, 4, "dark"); h.destroy(); return; }
        }
      }
      if (!this.invuln && this.overlap(pb, hb, 4)) {
        this.hurt(h.x);
        if (h.getData("kind") === "bolt") h.destroy();
      }
    });
  }

  /* ----------------------------- bosses ----------------------------- */
  startBoss(bs: Boss) {
    const a = bs.arena;
    bs.active = true;
    bs.state = "intro";
    bs.t = this.now + 1400;
    const cfg = bs.cfg;
    const s = this.physics.add.sprite(bs.home.x, bs.home.y - (cfg.flying ? 330 : 0), cfg.tex).setOrigin(0.5, 1).setDepth(5);
    const b = s.body as Phaser.Physics.Arcade.Body;
    b.setSize(cfg.bw, cfg.bh).setOffset((s.width - cfg.bw) / 2, s.height - cfg.bh);
    b.setAllowGravity(!cfg.flying);
    if (cfg.flying) b.setMaxVelocity(520, 520);
    s.setCollideWorldBounds(false);
    bs.collider = this.physics.add.collider(s, this.plats);
    bs.sprite = s;
    bs.hp = bs.max;
    bs.phase2 = false;
    bs.idx = 0;
    bs.dir = -1;
    // doors behind and ahead
    const door = (x: number) => {
      const z = this.add.zone(x, a.y - 300, 40, 1100);
      this.plats.add(z);
      this.plats.refresh();
      const g = this.add.rectangle(x, a.y - 300, 40, 1100, 0x0a0e18, 1).setDepth(4);
      g.setStrokeStyle(2, 0x8fb3d9, 0.5);
      z.setData("vis", g);
      return z;
    };
    bs.doors = [door(a.x0 + 70), door(a.x1 - 50)];
    this.toast(cfg.id === "unlit" ? site.finalBossLine : `${cfg.name} stirs.`, true);
    audio.sfx("boss");
    audio.setTension(1);
    this.cameras.main.shake(500, 0.006);
    this.emitHud();
  }

  clearDoors(bs: Boss) {
    bs.doors.forEach((d) => {
      (d.getData("vis") as Phaser.GameObjects.Rectangle | undefined)?.destroy();
      d.destroy();
    });
    bs.doors = [];
  }

  resetBoss(bs: Boss) {
    this.clearDoors(bs);
    bs.collider?.destroy();
    bs.collider = undefined;
    bs.sprite?.destroy();
    bs.sprite = null;
    bs.active = false;
    bs.hp = bs.max;
    bs.state = "idle";
  }

  hitBoss(bs: Boss) {
    if (bs.state === "intro" || !bs.sprite) return;
    bs.hp -= 1;
    audio.sfx("hit");
    this.burst(bs.sprite.x + (Math.random() - 0.5) * 60, bs.sprite.y - 80, 8, "white");
    this.cameras.main.shake(90, 0.005);
    bs.sprite.setTint(0xffffff);
    this.time.delayedCall(70, () => bs.sprite?.active && bs.sprite.clearTint());
    if (!bs.phase2 && bs.hp <= bs.max / 2) {
      bs.phase2 = true;
      this.toast(bs.cfg.id === "unlit" ? "It burns brighter." : `${bs.cfg.name} is angry now.`);
    }
    if (bs.hp <= 0) this.bossDie(bs);
    this.emitHud();
  }

  bossDie(bs: Boss) {
    const s = bs.sprite!;
    audio.sfx("bossdie");
    audio.setTension(0);
    this.cameras.main.flash(500, 255, 230, 190);
    this.cameras.main.shake(700, 0.012);
    this.burst(s.x, s.y - 90, 60, "ember");
    this.burst(s.x, s.y - 90, 40, "white");
    this.tweens.add({ targets: s, alpha: 0, duration: 900, onComplete: () => s.destroy() });
    (s.body as Phaser.Physics.Arcade.Body).enable = false;
    bs.collider?.destroy();
    bs.collider = undefined;
    bs.sprite = null;
    bs.active = false;
    this.hostiles.clear(true, true);
    this.clearDoors(bs);
    if (!this.S.bosses.includes(bs.cfg.id)) this.S.bosses.push(bs.cfg.id);
    this.save();
    this.toast(bs.cfg.id === "unlit" ? "The dark gives way. One flame is left to light." : `${bs.cfg.name} falls. A flame can be lit now.`, true);
    this.emitHud();
  }

  updateBosses(time: number, dt: number) {
    const p = this.player;
    for (const bs of this.bosses) {
      const a = bs.arena;
      if (!bs.active) {
        if (!this.S.bosses.includes(bs.cfg.id) && p.x > a.triggerX && p.x < a.x1 - 120 && Math.abs(p.y - a.y) < 160) this.startBoss(bs);
        continue;
      }
      const s = bs.sprite;
      if (!s || !s.active) continue;
      const b = s.body as Phaser.Physics.Arcade.Body;
      const dx = p.x - s.x;
      const sm = bs.phase2 ? 1.3 : 1;
      if (bs.state === "intro") {
        s.setFlipX(dx > 0);
        if (time > bs.t) { bs.state = "wait"; bs.t = time + 400; }
      } else if (bs.cfg.flying) this.archivistAI(bs, time, dt, sm);
      else this.bruteAI(bs, time, sm);
      // contact
      if (!this.invuln && this.overlap(p.body as Phaser.Physics.Arcade.Body, b, 8)) this.hurt(s.x);
      s.setFlipX(bs.cfg.id === "archivist" ? false : dx > 0);
      // bar updates
      if (time - this.lastHudAt > 150) { this.lastHudAt = time; this.emitHud(); }
    }
  }

  bruteAI(bs: Boss, time: number, sm: number) {
    const s = bs.sprite!;
    const b = s.body as Phaser.Physics.Arcade.Body;
    const p = this.player;
    const a = bs.arena;
    const dx = p.x - s.x;
    const dir = dx > 0 ? 1 : -1;
    const patterns = bs.cfg.patterns;
    switch (bs.state) {
      case "wait":
        b.setVelocityX(approach(b.velocity.x, 0, 1600 * 0.016));
        if (time > bs.t) {
          const pick = patterns[bs.idx++ % patterns.length];
          bs.dir = dir as 1 | -1;
          if (pick === "charge") { bs.state = "tele_charge"; bs.t = time + 560 / sm; s.setTint(0xffa890); }
          else if (pick === "slam") { bs.state = "tele_slam"; bs.t = time + 480 / sm; s.setTint(0xe0d0ff); }
          else { bs.state = "tele_ring"; bs.t = time + 700 / sm; s.setTint(0xffd9a0); }
        }
        break;
      case "tele_charge":
        s.x += Math.sin(time / 22) * 0.9;
        if (time > bs.t) { s.clearTint(); bs.state = "charge"; bs.t = time + 900; bs.dir = dir as 1 | -1; audio.sfx("dash"); }
        break;
      case "charge":
        b.setVelocityX(bs.dir * 540 * sm);
        if (time > bs.t || s.x < a.x0 + 130 || s.x > a.x1 - 110) { bs.state = "wait"; bs.t = time + 900 / sm; b.setVelocityX(0); }
        break;
      case "tele_slam":
        s.x += Math.sin(time / 22) * 0.9;
        if (time > bs.t) {
          s.clearTint();
          bs.state = "air";
          bs.airSince = time;
          b.setVelocity(clamp(dx * 1.05, -430, 430), -860);
        }
        break;
      case "air":
        if (time - bs.airSince > 200 && b.blocked.down) {
          bs.state = "wait";
          bs.t = time + 800 / sm;
          b.setVelocityX(0);
          this.cameras.main.shake(300, 0.012);
          audio.sfx("hit");
          this.burst(s.x, s.y, 16, "dark");
          const n = bs.cfg.id === "unlit" ? 2 : 1;
          for (let i = 0; i < n; i++) {
            this.time.delayedCall(i * 380, () => {
              if (!bs.active) return;
              for (const d of [-1, 1]) this.spawnWave(s.x, a.y, d, 330 * sm);
            });
          }
        }
        break;
      case "tele_ring":
        if (time > bs.t) {
          s.clearTint();
          const count = bs.phase2 ? 14 : 10;
          const off = Math.random() * 6.28;
          for (let i = 0; i < count; i++) this.fireBoltAngle(s.x, s.y - 110, off + (i / count) * 6.283, 210 + (bs.phase2 ? 40 : 0));
          audio.sfx("boss");
          bs.state = "wait";
          bs.t = time + 1100 / sm;
        }
        break;
    }
  }

  spawnWave(x: number, floorY: number, dir: number, speed: number) {
    const w = this.hostiles.create(x + dir * 40, floorY - 23, "wave") as Phaser.Physics.Arcade.Sprite;
    w.setDepth(5).setFlipX(dir < 0);
    (w.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(52, 38).setOffset(9, 8);
    w.setVelocityX(dir * speed);
    w.setData("kind", "wave").setData("die", this.now + 2400);
  }

  archivistAI(bs: Boss, time: number, dt: number, sm: number) {
    const s = bs.sprite!;
    const b = s.body as Phaser.Physics.Arcade.Body;
    const p = this.player;
    const a = bs.arena;
    const floatTo = (tx: number, ty: number, k = 1.8) => {
      b.setVelocity(clamp((tx - s.x) * k, -300 * sm, 300 * sm), clamp((ty - s.y) * k, -300 * sm, 300 * sm));
    };
    switch (bs.state) {
      case "wait": {
        const tx = clamp(p.x + Math.sin(time / 900) * 280, a.x0 + 200, a.x1 - 200);
        floatTo(tx, a.y - 300 + Math.sin(time / 600) * 40);
        if (time > bs.t) {
          const pick = bs.cfg.patterns[bs.idx++ % bs.cfg.patterns.length];
          bs.state = "tele_" + pick;
          bs.t = time + 600 / sm;
          s.setTint(0xe0d0ff);
        }
        break;
      }
      case "tele_fan":
        floatTo(s.x, a.y - 300, 3);
        if (time > bs.t) {
          s.clearTint();
          const base = Math.atan2(p.y - 40 - (s.y - 80), p.x - s.x);
          const n = bs.phase2 ? 7 : 5;
          for (let i = 0; i < n; i++) this.fireBoltAngle(s.x, s.y - 80, base + (i - (n - 1) / 2) * 0.28, 300);
          audio.sfx("slash");
          bs.state = "wait";
          bs.t = time + 1300 / sm;
        }
        break;
      case "tele_rain":
        floatTo(s.x, a.y - 420, 3);
        if (time > bs.t) {
          s.clearTint();
          const n = bs.phase2 ? 11 : 8;
          for (let i = 0; i < n; i++) {
            this.time.delayedCall(i * 160, () => {
              if (!bs.active) return;
              const x = a.x0 + 160 + Math.random() * (a.x1 - a.x0 - 320);
              const bolt = this.fireBoltAngle(x, a.y - 640, Math.PI / 2, 380);
              bolt.setScale(1.3);
            });
          }
          bs.state = "wait";
          bs.t = time + 1900 / sm;
        }
        break;
      case "tele_dive":
        b.setVelocity(0, 0);
        s.x += Math.sin(time / 22) * 1.2;
        if (time > bs.t) { s.clearTint(); bs.state = "dive"; bs.t = time + 900; audio.sfx("dash"); bs.home = { x: p.x, y: a.y - 70 }; }
        break;
      case "dive": {
        const dx2 = bs.home.x - s.x, dy2 = bs.home.y - s.y;
        const d = Math.hypot(dx2, dy2) || 1;
        b.setVelocity((dx2 / d) * 620 * sm, (dy2 / d) * 620 * sm);
        if (d < 40 || time > bs.t) { bs.state = "rise"; bs.t = time + 700; this.cameras.main.shake(180, 0.007); this.burst(s.x, s.y, 10, "dark"); }
        break;
      }
      case "rise":
        floatTo(clamp(p.x, a.x0 + 200, a.x1 - 200), a.y - 300, 2);
        if (time > bs.t) { bs.state = "wait"; bs.t = time + 900 / sm; bs.home = { x: a.x0 + (a.x1 - a.x0) * 0.72, y: a.y }; }
        break;
    }
    void dt;
  }

  /* ----------------------------- interactions ----------------------------- */
  lightReady(l: LightDef): { ok: boolean; hint: string } {
    const S = this.S;
    switch (l.kind) {
      case "reach": return { ok: true, hint: "" };
      case "kills": return { ok: S.kills >= (l.n ?? 0), hint: `The flame won't catch. Defeat ${Math.max(0, (l.n ?? 0) - S.kills)} more creatures.` };
      case "wisps": return { ok: S.wisps.length >= (l.n ?? 0), hint: `The flame wants wisps. ${Math.max(0, (l.n ?? 0) - S.wisps.length)} more to gather.` };
      case "tablets": return { ok: S.tablets.length >= (l.n ?? 0), hint: `Read the old tablets first (${S.tablets.length}/${l.n}). Stand near one and press E.` };
      case "boss": return { ok: S.bosses.includes(l.boss ?? ""), hint: "Something guards this flame." };
      case "timer": return { ok: this.timerUntil > this.now, hint: "The flame is cold. Step on the rune behind you, then run." };
    }
  }

  updateInteractions(time: number) {
    const p = this.player;
    const px = p.x, py = p.y;
    let hint: string | null = null;
    const useJust = this.just(this.keys.use);

    // wisps
    for (let i = this.wispObjs.length - 1; i >= 0; i--) {
      const w = this.wispObjs[i];
      if (Math.abs(w.img.x - px) < 42 && Math.abs(w.img.y - (py - 40)) < 70) {
        this.S.wisps.push(w.id);
        audio.sfx("wisp");
        this.burst(w.img.x, w.img.y, 10, "white");
        w.img.destroy();
        w.glow.destroy();
        this.wispObjs.splice(i, 1);
        this.save();
        this.emitHud();
      }
    }
    // altars
    for (const a of this.altarObjs) {
      if (this.S.abilities[a.def.ability]) continue;
      if (Math.abs(a.def.x - px) < 70 && Math.abs(a.def.y - py) < 160) this.grantAbility(a);
    }
    // benches
    for (const b of this.benchObjs) {
      if (Math.abs(b.x - px) < 70 && Math.abs(b.y - py) < 90) {
        hint = this.S.bench === b.id && this.hp === this.maxHp ? "E   rest here" : "E   rest · restore flame";
        if (useJust) this.rest(b);
      }
    }
    // tablets
    for (const t of this.tabletObjs) {
      if (Math.abs(t.x - px) < 70 && Math.abs(t.y - py) < 90) {
        hint = "E   read";
        if (useJust) {
          audio.sfx("tablet");
          this.toast(t.text, true);
          if (!this.S.tablets.includes(t.id)) {
            this.S.tablets.push(t.id);
            this.save();
            this.emitHud();
          }
        }
      }
    }
    // rune plate
    for (const pl of this.L.plates) {
      if (Math.abs(pl.x - px) < 46 && Math.abs(pl.y - py) < 30 && this.timerUntil < time) {
        this.timerUntil = time + this.L.timerMs;
        audio.sfx("rune");
        this.toast("The rune burns. Run.", true);
        this.burst(pl.x, pl.y - 6, 14, "ember");
        this.emitHud();
      }
    }
    // lights
    for (const l of this.lanterns) {
      if (l.lit) continue;
      if (Math.abs(l.def.x - px) < 80 && Math.abs(l.def.y - py) < 170) {
        const r = this.lightReady(l.def);
        if (r.ok) this.ignite(l);
        else hint = r.hint;
      }
    }
    this.setHint(hint);
  }

  grantAbility(a: GameScene["altarObjs"][number]) {
    const ab = a.def.ability;
    this.S.abilities[ab] = true;
    audio.sfx("altar");
    this.burst(a.def.x, a.def.y - 130, 40, "ember");
    this.cameras.main.flash(400, 255, 225, 170);
    a.orb.setVisible(false);
    a.glow.setVisible(false);
    const msg = {
      dash: "You carry the Swift Ember. You can dash. Press K.",
      wall: "You remember how to hold on. Press toward a wall in the air to cling. SPACE to leap off.",
      double: "The last gift. Press SPACE again in the air to leap twice.",
    }[ab];
    this.toast(msg, true);
    this.save();
    this.emitHud();
  }

  rest(b: { id: string; x: number; y: number }) {
    this.S.bench = b.id;
    this.hp = this.maxHp;
    this.restUntil = this.now + 900;
    audio.sfx("bench");
    this.burst(b.x - 34, b.y - 48, 14, "ember");
    this.cameras.main.flash(300, 255, 220, 170, true);
    this.spawnFoes();
    this.timerUntil = 0;
    this.save();
    this.toast(this.restLine(), false);
    this.emitHud();
  }

  restLine() {
    const q = site.quirks.filter((x) => !x.startsWith("PLACEHOLDER"));
    const generic = ["The flame steadies.", "You rest. The dark waits.", "Still here."];
    const pool = [...generic, ...q];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  ignite(l: LightObj) {
    l.lit = true;
    this.S.lit.push(l.def.slot);
    this.frozen = true;
    audio.sfx("light");
    l.sprite.setTexture("lantern_on");
    l.glow.setTint(0xffc070);
    this.tweens.add({ targets: l.glow, scale: 5, alpha: 0.9, duration: 500, yoyo: true, ease: "Sine.out" });
    this.burst(l.def.x, l.def.y - 110, 50, "ember");
    this.cameras.main.flash(500, 255, 225, 170);
    this.save();
    this.emitHud();
    this.setHint(null);
    this.time.delayedCall(1300, () => {
      this.frozen = false;
      bus.emit("letter", { slot: l.def.slot, title: l.def.title, count: this.S.lit.length });
    });
  }

  skipAll() {
    for (const l of this.L.lights) {
      if (!this.S.lit.includes(l.slot)) this.S.lit.push(l.slot);
    }
    for (const lo of this.lanterns) {
      lo.lit = true;
      lo.sprite.setTexture("lantern_on");
      lo.glow.setTint(0xffc070).setScale(2.4).setAlpha(0.5);
    }
    this.save();
    this.emitHud();
  }

  /* dev helpers (only reachable with ?dev in the URL) */
  /** dev/test only: scripted input (see scripts in README) */
  bot: null | { dir: number; jump: boolean; jumpJust: boolean; dashJust: boolean; atkJust: boolean } = null;

  dev = {
    tp: (x: number, y: number) => this.player.setPosition(x, y),
    grant: () => { this.S.abilities = { dash: true, wall: true, double: true }; this.emitHud(); },
    kills: (n: number) => { this.S.kills = n; this.emitHud(); },
  };
}
