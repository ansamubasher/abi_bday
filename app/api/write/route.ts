import { fail, json, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/session";
import { MAX_BODY, getLetter, isLocked, saveLetter, writerByToken } from "@/lib/letters";

async function auth(req: Request) {
  const token = req.headers.get("x-writer-token") ?? "";
  return writerByToken(token);
}

export async function GET(req: Request) {
  if (!(await rateLimit("write-get", 120, 60))) return fail(429, "Slow down.");
  const w = await auth(req);
  if (!w) return fail(404, "This link isn't valid.");
  const letter = await getLetter(w.id); // only THIS writer's letter, by construction
  return json({
    name: w.name,
    locked: await isLocked(),
    letter: letter ? { body: letter.body, from: letter.from } : null,
    max: MAX_BODY,
  });
}

export async function PUT(req: Request) {
  if (!(await rateLimit("write-put", 90, 60))) return fail(429, "Slow down.");
  const w = await auth(req);
  if (!w) return fail(404, "This link isn't valid.");
  if (await isLocked()) return fail(423, "Letters are closed now.");
  const b = await readJson<{ body?: string; from?: string }>(req);
  const body = typeof b?.body === "string" ? b.body : "";
  const from = typeof b?.from === "string" ? b.from : "";
  if (body.length > MAX_BODY) return fail(413, "That's a little long.");
  const saved = await saveLetter(w.id, body, from);
  return json({ ok: true, savedAt: saved.updatedAt });
}
