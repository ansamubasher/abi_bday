"use client";
import { useCallback, useEffect, useState } from "react";

type Row = { id: string; slot: number; name: string; words: number; updatedAt: number | null };
type State = { locked: boolean; max: number; invite: string; writers: Row[] };

export default function AdminClient({ signedIn, heroName }: { signedIn: boolean; heroName: string }) {
  const [authed, setAuthed] = useState(signedIn);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [st, setSt] = useState<State | null>(null);
  const [copied, setCopied] = useState(false);

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

  const shareLink = `${location.origin}/join/${st.invite}`;

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

      <div style={{ marginTop: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>send this one link to all your friends</div>
        <div className="row">
          <input className="field" readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} />
          <button
            className="btn"
            onClick={async () => {
              await navigator.clipboard.writeText(shareLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          They type their name and letter and press send. They can't see anyone else's letter, and the link can't open the game.
          You can't read the letters either.
        </p>
      </div>

      <div className="bar"><i style={{ width: `${(st.writers.length / st.max) * 100}%` }} /></div>
      <p className="note" style={{ marginTop: 8 }}>{st.writers.length} of {st.max} letters in</p>

      <table className="table">
        <tbody>
          {st.writers.map((w) => (
            <tr key={w.id}>
              <td style={{ color: "var(--dim)" }}>{w.slot + 1}</td>
              <td>{w.name}</td>
              <td><span className="pill ok">{w.words} words</span></td>
              <td style={{ textAlign: "right" }}>
                <button className="btn small danger" onClick={() => { if (confirm(`Remove ${w.name} and delete their letter? They can send a new one.`)) call(`/api/admin/writers/${w.id}`, "DELETE"); }}>Remove</button>
              </td>
            </tr>
          ))}
          {st.writers.length === 0 && (
            <tr><td className="note">Nobody has sent a letter yet.</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 40, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
        <p className="note">Close letters a day before the birthday. After that, nobody can send anything new.</p>
        <button className={`btn ${st.locked ? "" : "ghost"}`} onClick={() => call("/api/admin/lock", "POST", { locked: !st.locked })}>
          {st.locked ? "Letters are closed · reopen" : "Close letters"}
        </button>
      </div>
    </div>
  );
}
