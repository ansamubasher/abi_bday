import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { fail, json, readJson } from "@/lib/api";
import { clearSession, rateLimit, setSession } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await rateLimit("admin", 8, 15 * 60))) return fail(429, "Too many tries.");
  const b = await readJson<{ code?: string }>(req);
  const code = String(b?.code ?? "").trim();
  if (!code || !safeEqual(code, env("ADMIN_CODE").trim())) return fail(401, "Wrong code.");
  await setSession("admin");
  return json({ ok: true });
}

export async function DELETE() {
  await clearSession("admin");
  return json({ ok: true });
}
