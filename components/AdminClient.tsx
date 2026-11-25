"use client";
import { useCallback, useEffect, useState } from "react";

type Row = { id: string; slot: number; name: string; token: string; written: boolean; words: number; updatedAt: number | null };
type State = { locked: boolean; max: number; writers: Row[] };

export default function AdminClient({ signedIn, heroName }: { signedIn: boolean; heroName: string }) {
  const [authed, setAuthed] = useState(signedIn);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [st, setSt] = useState<State | null>(null);
  const [names, setNames] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/state");
    if (r.status === 401) return setAuthed(false);
    setSt(await r.json());
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (r.ok) {
      setAuthed(true);
      setErr("");
    } else setErr((await r.json()).error ?? "Nope.");
  }

  async function call(url: string, method: string, body?: unknown) {
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    await load();
  }

  const link = (t: string) => `${location.origin}/write/${t}`;
  async function copy(row: Row) {
    await navigator.clipboard.writeText(link(row.token));
    setCopied(row.id);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!authed)
    return (
      <form className="panel" onSubmit={login} style={{ marginTop: "18vh" }}>
        <div className="eyebrow">organiser</div>
        <h1 className="title" style={{ fontSize: 48 }}>Backstage</h1>
        <div className="row">
          <input className="field" type="password" placeholder="Organiser code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <button className="btn" disabled={!code}>Enter</button>
        </div>
        <div className="err">{err}</div>
      </form>
    );

  if (!st) return <div className="panel loading">…</div>;

  const written = st.writers.filter((w) => w.written).length;
  const free = st.max - st.writers.length;

  return (
    <div className="panel wide" style={{ paddingBottom: 80 }}>
      <div className="admin-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>organiser</div>
          <h1 className="title" style={{ fontSize: 44, margin: 0 }}>Letters for {heroName}</h1>
        </div>
        <div className="row">
          <a className="btn ghost small" href="/play">Preview game</a>
          <button className="btn ghost small" onClick={async () => { await fetch("/api/admin/login", { method: "DELETE" }); setAuthed(false); }}>
            Sign out
          </button>
        </div>
      </div>

      <p className="note" style={{ marginTop: 14 }}>
        You can see who has written and roughly how much. You can't read the letters here, and neither
        can anyone else. Only {heroName}'s passcode opens them. "Preview game" uses placeholder text.
      </p>

      <div className="bar"><i style={{ width: `${(written / st.max) * 100}%` }} /></div>
      <p className="note" style={{ marginTop: 8 }}>{written} of {st.max} letters written · {st.writers.length} invited</p>

      <table className="table">
        <thead>
          <tr><th>#</th><th>Writer</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {st.writers.map((w) => (
            <tr key={w.id}>
              <td style={{ color: "var(--dim)" }}>{w.slot + 1}</td>
              <td>{w.name}</td>
              <td>
                {w.written ? <span className="pill ok">{w.words} words</span> : <span className="pill warn">waiting</span>}
              </td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <button className="btn small" onClick={() => copy(w)}>{copied === w.id ? "Copied ✓" : "Copy link"}</button>{" "}
                <button className="btn small ghost" onClick={() => { if (confirm(`Make a new link for ${w.name}? The old link stops working.`)) call(`/api/admin/writers/${w.id}`, "PATCH", { regen: true }); }}>New link</button>{" "}
                <button className="btn small danger" onClick={() => { if (confirm(`Remove ${w.name} and delete their letter?`)) call(`/api/admin/writers/${w.id}`, "DELETE"); }}>Remove</button>
              </td>
            </tr>
          ))}
          {st.writers.length === 0 && (
            <tr><td colSpan={4} className="note">Nobody invited yet.</td></tr>
          )}
        </tbody>
      </table>

      {free > 0 && (
        <div style={{ marginTop: 30 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>invite writers ({free} spots left)</div>
          <textarea className="field" rows={5} placeholder={"One name per line\nPriya\nOmar\n…"} value={names} onChange={(e) => setNames(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" disabled={!names.trim()} onClick={async () => { await call("/api/admin/writers", "POST", { names: names.split("\n") }); setNames(""); }}>
              Create links
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 40, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>deadline</div>
        <p className="note">
          Closing letters stops all further edits. Do this a day before the birthday.
        </p>
        <button className={`btn ${st.locked ? "" : "ghost"}`} onClick={() => call("/api/admin/lock", "POST", { locked: !st.locked })}>
          {st.locked ? "Letters are closed · reopen" : "Close letters"}
        </button>
      </div>
    </div>
  );
}
