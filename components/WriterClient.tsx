"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Loaded = { name: string; locked: boolean; letter: { body: string; from: string } | null; max: number };

export default function WriterClient({ token, heroName }: { token: string; heroName: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [bad, setBad] = useState(false);
  const [body, setBody] = useState("");
  const [from, setFrom] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/write", { headers: { "x-writer-token": token } });
      if (!r.ok) return setBad(true);
      const d: Loaded = await r.json();
      setData(d);
      setBody(d.letter?.body ?? "");
      setFrom(d.letter?.from ?? d.name);
    })();
  }, [token]);

  const save = useCallback(
    async (b: string, f: string) => {
      setState("saving");
      try {
        const r = await fetch("/api/write", {
          method: "PUT",
          headers: { "x-writer-token": token, "Content-Type": "application/json" },
          body: JSON.stringify({ body: b, from: f }),
        });
        if (!r.ok) throw new Error();
        dirty.current = false;
        setState("saved");
      } catch {
        setState("error");
      }
    },
    [token]
  );

  function change(b: string, f: string) {
    setBody(b);
    setFrom(f);
    dirty.current = true;
    setState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(b, f), 900);
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (bad)
    return (
      <div className="panel">
        <h1 className="title" style={{ fontSize: 40 }}>This link doesn't work.</h1>
        <p className="sub">Ask whoever sent it for a fresh one.</p>
      </div>
    );
  if (!data) return <div className="panel loading">…</div>;

  const max = data.max;
  return (
    <div className="panel wide" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <div className="eyebrow">a letter for</div>
      <h1 className="title" style={{ fontSize: "clamp(40px, 8vw, 64px)" }}>{heroName}</h1>
      <p className="sub" style={{ marginBottom: 8 }}>
        Hi {data.name}. You've been asked to write one letter. It'll be hidden in a small game and
        found a little at a time.
      </p>
      <p className="note">
        Only {heroName} will ever read it. Not the other writers, and not the organiser's page,
        which shows who has written and nothing else. You can come back to this link and change
        it until letters close.
      </p>
      <ul className="prompts">
        <li>Say the thing you'd say if you weren't embarrassed.</li>
        <li>A specific memory beats a general compliment.</li>
        <li>Short is fine. Honest is better.</li>
      </ul>

      {data.locked ? (
        <p className="err" style={{ marginTop: 28 }}>Letters are closed now, so this one is final.</p>
      ) : null}

      <div className="paper-editor">
        <textarea
          className="field"
          value={body}
          maxLength={max}
          disabled={data.locked}
          placeholder={`Dear ${heroName},`}
          onChange={(e) => change(e.target.value, from)}
          aria-label="Your letter"
        />
        <input
          className="field sig"
          value={from}
          maxLength={60}
          disabled={data.locked}
          onChange={(e) => change(body, e.target.value)}
          placeholder="Signed as…"
          aria-label="Signed as"
        />
        <div className="status">
          <span>
            {state === "saving" && "Saving…"}
            {state === "saved" && "Saved ✓"}
            {state === "error" && <span style={{ color: "var(--danger)" }}>Couldn't save. Retrying when you type.</span>}
            {state === "idle" && (dirty.current ? "Unsaved…" : body ? "Saved ✓" : "")}
          </span>
          <span>
            {body.length} / {max}
          </span>
        </div>
      </div>
    </div>
  );
}
