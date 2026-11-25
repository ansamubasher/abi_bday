import { env, optionalEnv } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { fail, json, readJson } from "@/lib/api";
import { rateLimit, setSession } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await rateLimit("unlock", 8, 15 * 60))) {
    return fail(429, "Too many tries. Give it a few minutes.");
  }
  const body = await readJson<{ code?: string }>(req);
  const code = String(body?.code ?? "").trim().toLowerCase();
  if (!code || !safeEqual(code, env("HERO_CODE").trim().toLowerCase())) {
    return fail(401, "That isn't it.");
  }
  const at = optionalEnv("UNLOCK_AT");
  if (at && Date.now() < new Date(at).getTime()) {
    return json({ error: "early", until: new Date(at).toISOString() }, 403);
  }
  await setSession("hero");
  return json({ ok: true });
}
