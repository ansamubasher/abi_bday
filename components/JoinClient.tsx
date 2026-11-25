"use client";
import { useState } from "react";

const MAX = 8000;

/** What a friend sees: their name, their letter, one button. */
export default function JoinClient({ code, heroName, closed, full }: { code: string; heroName: string; closed: boolean; full: boolean }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error ?? "That didn't go through. Please try again.");
      else setDone(true);
    } catch {
      setErr("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  const head = (
    <>
      <div className="eyebrow">a letter for</div>
      <h1 className="title" style={{ fontSize: "clamp(40px, 8vw, 64px)" }}>{heroName}</h1>
    </>
  );

  if (done)
    return (
      <div className="panel">
        {head}
        <p className="sub">Sent. Thank you, {name.trim()}.</p>
        <p className="note">Only {heroName} will read it. You can close this page.</p>
      </div>
    );

  if (closed || full)
    return (
      <div className="panel">
        {head}
        <p className="sub">{closed ? "Letters are closed now." : "All 22 letters are already in."}</p>
        <p className="note">Thank you for wanting to write one.</p>
      </div>
    );

  return (
    <form className="panel wide" onSubmit={send} style={{ paddingTop: 24, paddingBottom: 60 }}>
      {head}
      <p className="sub" style={{ marginBottom: 8 }}>Write one letter. Only {heroName} will ever read it.</p>
      <p className="note">Not the other friends, and not the organiser.</p>

      <div className="paper-editor" style={{ marginTop: 20 }}>
        <input
          className="field sig"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="name"
          style={{ marginBottom: 12 }}
        />
        <textarea
          className="field"
          value={body}
          maxLength={MAX}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Dear ${heroName},`}
          aria-label="Your letter"
          style={{ minHeight: 260, height: "42vh" }}
        />
        <div className="status">
          <span>{err ? <span style={{ color: "var(--danger)" }}>{err}</span> : ""}</span>
          <span>{body.length} / {MAX}</span>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <button className="btn" disabled={busy || !name.trim() || !body.trim()}>{busy ? "Sending…" : "Send my letter"}</button>
      </div>
      <p className="note" style={{ marginTop: 14 }}>You can't edit it after sending, so read it over once first.</p>
    </form>
  );
}
