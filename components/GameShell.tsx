"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { bus, HudState } from "@/game/bus";
import { audio } from "@/game/audio";
import { clearSave, loadSave, writeSave, Save } from "@/game/state";
import { ZONE_NAMES } from "@/game/level";

type Phase = "loading" | "title" | "play" | "pause" | "letter" | "journal" | "ending";
type LetterData = { slot: number; from: string; body: string; pending?: boolean; preview?: boolean };
type Toast = { id: number; text: string; big: boolean };

const LIGHT_TITLES: Record<number, string> = {};

const EMPTY: HudState = {
  hp: 5, maxHp: 5, lit: [], wisps: 0, kills: 0, zone: 0, boss: null, timer: 0, tablets: 0,
  abilities: { dash: false, wall: false, double: false },
};

function Flame({ on }: { on: boolean }) {
  return (
    <svg className={`flame ${on ? "" : "off"}`} viewBox="0 0 16 22" aria-hidden>
      <path d="M8 1c1 4 6 6.500 6 12a6 6 0 0 1-12 0c0-2.500 1.200-4 2.400-5.200C5.300 9 6 10 7 10c0-3-.5-6 1-9z" fill="#ffcf85" stroke="#8a5a1c" strokeWidth=".8" />
    </svg>
  );
}

export default function GameShell({
  heroName, title, birthday, age, preview,
}: { heroName: string; title: string; birthday: string; age: number | null; preview: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (b: boolean) => void } | null>(null);
  const phaseRef = useRef<Phase>("loading");
  const [phase, setPhaseState] = useState<Phase>("loading");
  const [hud, setHud] = useState<HudState>(EMPTY);
  const hudRef = useRef<HudState>(EMPTY);
  const [hint, setHint] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [zoneCard, setZoneCard] = useState<{ n: number; name: string; sub: string } | null>(null);
  const [letter, setLetter] = useState<LetterData | null>(null);
  const [letterMeta, setLetterMeta] = useState<{ title: string; count: number } | null>(null);
  const [letterFrom, setLetterFrom] = useState<"game" | "journal">("game");
  const [save, setSave] = useState<Save | null>(null);
  const [muted, setMuted] = useState(false);
  const [confirm, setConfirm] = useState<null | "skip" | "restart">(null);
  const [titles, setTitles] = useState<Record<number, string>>(LIGHT_TITLES);
  const toastId = useRef(0);
  const bootId = useRef(0);
  const [err, setErr] = useState("");

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  /* ---------- boot / (re)create the game ---------- */
  const boot = useCallback(
    async (s: Save) => {
      const myId = ++bootId.current;
      setPhase("loading");
      gameRef.current?.destroy(true);
      gameRef.current = null;
      if (host.current) host.current.innerHTML = "";
      try {
        const { createGame } = await import("@/game");
        if (myId !== bootId.current || !host.current) return; // superseded (strict mode / restart)
        gameRef.current = createGame(host.current, s);
      } catch (e) {
        console.error(e);
        setErr("The game couldn't start in this browser.");
      }
    },
    [setPhase]
  );

  useEffect(() => {
    const s = loadSave();
    setSave(s);
    setMuted(s.muted);
    audio.muted = s.muted;
    const offs = [
      bus.on("ready", () => setPhase("title")),
      bus.on("state", (st: HudState) => { hudRef.current = st; setHud(st); setTitles((t) => t); }),
      bus.on("hint", (h: string | null) => setHint(h)),
      bus.on("toast", (text: string, big: boolean) => {
        const id = ++toastId.current;
        setToasts((t) => [...t.slice(-1), { id, text, big }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), big ? 6500 : 4200);
      }),
      bus.on("zone", (n: number, z: { name: string; sub: string }) => setZoneCard({ n: Date.now(), name: z.name, sub: z.sub })),
      bus.on("letter", async (m: { slot: number; title: string; count: number }) => {
        bus.emit("pause");
        setLetterMeta({ title: m.title, count: m.count });
        setTitles((t) => ({ ...t, [m.slot]: m.title }));
        setLetterFrom("game");
        await openLetter(m.slot);
      }),
    ];
    boot(s);
    return () => {
      bootId.current++;
      offs.forEach((f) => f());
      gameRef.current?.destroy(true);
      gameRef.current = null;
      audio.dispose();
      bus.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openLetter(slot: number) {
    setLetter(null);
    setPhase("letter");
    audio.sfx("letter");
    try {
      const r = await fetch(`/api/letters/${slot}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      setLetter(await r.json());
    } catch {
      setLetter({ slot, from: "", body: "This letter couldn't be fetched. Check your connection and open it again from the journal.", pending: true });
    }
  }

  function closeLetter() {
    setLetter(null);
    if (letterFrom === "journal") return setPhase("journal");
    bus.emit("resume");
    if (hudRef.current.lit.length >= 22) setPhase("ending");
    else setPhase("play");
  }

  /* ---------- keyboard: pause, journal, mute ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (p === "play") { bus.emit("pause"); setPhase("pause"); }
        else if (p === "pause") { bus.emit("resume"); setPhase("play"); setConfirm(null); }
        else if (p === "journal") { setPhase("pause"); }
        else if (p === "letter") closeLetter();
      } else if (e.key.toLowerCase() === "l" && (p === "play")) {
        bus.emit("pause"); setPhase("journal");
      } else if (e.key.toLowerCase() === "m" && p !== "loading") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterFrom]);

  function toggleMute() {
    const m = !audio.muted;
    audio.setMuted(m);
    setMuted(m);
    bus.emit("mute", m);
  }

  function begin() {
    audio.init();
    audio.setMuted(muted);
    audio.sfx("click");
    if (save && !save.started) { const s = { ...save, started: true }; writeSave(s); setSave(s); }
    bus.emit("resume");
    bus.emit("request-hud");
    setPhase("play");
  }

  function setEasy(on: boolean) {
    if (!save) return;
    const s = { ...save, easy: on };
    writeSave(s);
    setSave(s);
    boot(s); // maxHp is read at scene creation
  }

  function newGame() {
    clearSave();
    const s = loadSave();
    setSave(s);
    setConfirm(null);
    setToasts([]);
    boot(s);
  }

  function skipAll() {
    bus.emit("skip-all");
    setConfirm(null);
    setPhase("journal");
  }

  const lit = new Set(hud.lit);
  const started = !!save?.started && (hud.lit.length > 0 || hud.kills > 0 || hud.wisps > 0);

  return (
    <div className="game-root">
      <div ref={host} className="canvas-host" />
      <div className="vignette" />

      {phase !== "loading" && phase !== "title" && (
        <div className="hud">
          <div className="top-left">
            <div className="flames" aria-label={`Health ${hud.hp} of ${hud.maxHp}`}>
              {Array.from({ length: hud.maxHp }, (_, i) => <Flame key={i} on={i < hud.hp} />)}
            </div>
            <div className="counter">
              <span>wisps <b>{hud.wisps}</b></span>
              <span>lights <b>{hud.lit.length}</b>/22</span>
            </div>
          </div>
          <div className="dots" aria-hidden>
            {Array.from({ length: 22 }, (_, i) => <i key={i} className={lit.has(i) ? "on" : ""} />)}
          </div>
          {hud.timer > 0 && <div className="timer">{hud.timer}</div>}
          {hint && <div className="hint">{hint}</div>}
          {zoneCard && (
            <div className="zone-card" key={zoneCard.n}>
              <h2>{zoneCard.name}</h2>
              <p>{zoneCard.sub}</p>
            </div>
          )}
          {toasts.map((t) => <div key={t.id} className={`toast ${t.big ? "big" : ""}`}>{t.text}</div>)}
          {hud.boss && (
            <div className="bossbar">
              <span>{hud.boss.name}</span>
              <div className="bar"><i style={{ width: `${Math.max(0, (hud.boss.hp / hud.boss.max) * 100)}%` }} /></div>
            </div>
          )}
          <div className="hud-btns">
            <button className="btn small ghost" onClick={() => { bus.emit("pause"); setPhase("journal"); }}>Letters (L)</button>
            <button className="btn small ghost" onClick={toggleMute}>{muted ? "Sound off" : "Sound on"} (M)</button>
            <button className="btn small ghost" onClick={() => { bus.emit("pause"); setPhase("pause"); }}>Pause (Esc)</button>
          </div>
          {preview && <div className="hint" style={{ bottom: 20, color: "var(--dim)", fontSize: 14 }}>Preview mode · letters here are placeholders</div>}
        </div>
      )}

      {phase === "loading" && (
        <div className="overlay solid">
          {err ? <div className="err">{err}</div> : <div className="loading">lighting the way…</div>}
        </div>
      )}

      {phase === "title" && (
        <div className="overlay solid">
          <div className="menu">
            <div className="lantern" />
            <div className="eyebrow">for {heroName}</div>
            <h1>{title}</h1>
            <p className="sub" style={{ marginBottom: 6 }}>Twenty-two lights went out.</p>
            <div className="col">
              <button className="btn" onClick={begin}>{started ? "Continue" : "Begin"}</button>
              {started && <button className="btn ghost" onClick={() => setConfirm("restart")}>Start over</button>}
            </div>
            <label className="toggle">
              <input type="checkbox" checked={!!save?.easy} onChange={(e) => setEasy(e.target.checked)} />
              Gentle mode (more health, softer bosses)
            </label>
            <div className="keys">
              <kbd>←</kbd><kbd>→</kbd> move · <kbd>Space</kbd> jump · <kbd>J</kbd> strike · <kbd>K</kbd> dash<br />
              <kbd>E</kbd> rest / read · <kbd>L</kbd> letters · <kbd>Esc</kbd> pause · <kbd>M</kbd> sound
            </div>
            <p className="note" style={{ marginTop: 18 }}>Headphones help.</p>
          </div>
          {confirm === "restart" && (
            <Confirm
              text="Start over? Lit lights and abilities will be forgotten."
              yes="Start over" no="Keep playing"
              onYes={newGame} onNo={() => setConfirm(null)}
            />
          )}
        </div>
      )}

      {phase === "pause" && (
        <div className="overlay">
          <div className="menu">
            <h1 style={{ fontSize: 44 }}>Paused</h1>
            <div className="col">
              <button className="btn" onClick={() => { bus.emit("resume"); setPhase("play"); }}>Resume</button>
              <button className="btn ghost" onClick={() => setPhase("journal")}>Letters you've found</button>
              <button className="btn ghost" onClick={toggleMute}>{muted ? "Turn sound on" : "Turn sound off"}</button>
              <button className="btn ghost" onClick={() => setConfirm("skip")}>I just want to read the letters</button>
              <button className="btn ghost" onClick={() => setConfirm("restart")}>Start over</button>
            </div>
            <p className="note" style={{ marginTop: 22 }}>
              Dash: K · Cling: press into a wall in the air · Rest at benches (E) to heal.
            </p>
          </div>
          {confirm === "skip" && (
            <Confirm
              text="This lights all 22 lanterns right now, so you can read every letter without playing. You can't undo it. Do it?"
              yes="Show me the letters" no="Not yet"
              onYes={skipAll} onNo={() => setConfirm(null)}
            />
          )}
          {confirm === "restart" && (
            <Confirm
              text="Start over? Lit lights, abilities and progress will be forgotten."
              yes="Start over" no="Keep playing"
              onYes={() => { newGame(); }} onNo={() => setConfirm(null)}
            />
          )}
        </div>
      )}

      {phase === "letter" && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && letter && closeLetter()}>
          <div className="letter-wrap">
            <div className="letter-meta">
              {letterMeta && letterFrom === "game" ? `Light ${letterMeta.count} of 22 · ${letterMeta.title}` : letter ? `Light ${letter.slot + 1} · ${titles[letter.slot] ?? ""}` : ""}
            </div>
            <div className="letter" role="document">
              {!letter ? <p style={{ opacity: 0.5 }}>…</p> : (
                <>
                  <p style={letter.pending ? { fontStyle: "italic", opacity: 0.7 } : undefined}>{letter.body}</p>
                  {letter.from && <div className="from">— {letter.from}</div>}
                </>
              )}
            </div>
            <div className="letter-actions">
              <button className="btn" onClick={closeLetter} disabled={!letter}>
                {letterFrom === "journal" ? "Back" : "Keep going"}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "journal" && (
        <div className="overlay">
          <div className="journal">
            <h2>Letters</h2>
            <p className="note" style={{ textAlign: "center" }}>{hud.lit.length} of 22 lights lit</p>
            <div className="jgrid">
              {Array.from({ length: 22 }, (_, i) => {
                const on = lit.has(i);
                return (
                  <button
                    key={i}
                    className={`jcard ${on ? "lit" : "dark"}`}
                    disabled={!on}
                    onClick={() => { setLetterFrom("journal"); setLetterMeta(null); openLetter(i); }}
                  >
                    <small>No. {i + 1}</small>
                    <span>{on ? titles[i] ?? "A lit lantern" : "—"}</span>
                  </button>
                );
              })}
            </div>
            <div className="letter-actions">
              <button className="btn" onClick={() => {
                if (hud.lit.length >= 22 && false) return;
                setPhase("pause");
              }}>Back</button>
              {hud.lit.length >= 22 && <button className="btn ghost" onClick={() => setPhase("ending")}>The ending</button>}
            </div>
          </div>
        </div>
      )}

      {phase === "ending" && (
        <div className="overlay solid" style={{ background: "radial-gradient(900px 600px at 50% 60%, rgba(255,217,160,.18), transparent 70%), #04060b" }}>
          <div className="ending">
            <div className="lantern" style={{ width: 22, height: 22 }} />
            <p className="fadeline" style={{ animationDelay: "0.4s" }}>All twenty-two lights are lit.</p>
            <h1 className="big fadeline" style={{ animationDelay: "2s" }}>{heroName}</h1>
            <p className="fadeline" style={{ animationDelay: "4s" }}>
              22 people wanted you to know something.
              {age ? <><br />Happy {age}.</> : null}
            </p>
            <p className="fadeline note" style={{ animationDelay: "6s" }}>{birthday}</p>
            <div className="letter-actions fadeline" style={{ animationDelay: "7.5s" }}>
              <button className="btn" onClick={() => setPhase("journal")}>Read them again</button>
              <button className="btn ghost" onClick={() => { bus.emit("resume"); setPhase("play"); }}>Keep exploring</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Confirm({ text, yes, no, onYes, onNo }: { text: string; yes: string; no: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="overlay" style={{ zIndex: 20, background: "rgba(2,3,8,.88)" }}>
      <div className="menu">
        <p className="sub">{text}</p>
        <div className="col">
          <button className="btn" onClick={onYes}>{yes}</button>
          <button className="btn ghost" onClick={onNo}>{no}</button>
        </div>
      </div>
    </div>
  );
}

export { ZONE_NAMES };
