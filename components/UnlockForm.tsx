"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UnlockForm({ signedIn, heroName }: { signedIn: boolean; heroName: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (r.ok) {
        router.push("/play");
        return;
      }
      if (d.error === "early") {
        const when = new Date(d.until).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
        setErr(`Not yet. This opens on ${when}.`);
      } else setErr(d.error ?? "Something went wrong.");
    } catch {
      setErr("Couldn't reach the server.");
    }
    setBusy(false);
  }

  if (signedIn) {
    return (
      <div>
        <button className="btn" onClick={() => router.push("/play")}>
          Continue, {heroName}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="row">
        <input
          className="field"
          type="password"
          autoComplete="off"
          placeholder="Passcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Passcode"
          autoFocus
        />
        <button className="btn" disabled={busy || !code.trim()}>
          Enter
        </button>
      </div>
      <div className="err" role="alert">{err}</div>
    </form>
  );
}
