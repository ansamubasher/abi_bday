import { fail, json, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/session";
import { safeEqual } from "@/lib/crypto";
import { MAX_BODY, createJoined, getInviteCode, isLocked } from "@/lib/letters";

/**
 * A friend sends their letter using the one shared link.
 * It never sets a session cookie, so it can't open the game or any letter.
 */
export async function POST(req: Request) {
  if (!(await rateLimit("join", 15, 3600))) return fail(429, "Too many tries. Please wait a little and try again.");
  const b = await readJson<{ code?: string; name?: string; body?: string }>(req);
  const code = typeof b?.code === "string" ? b.code : "";
  if (!code || !safeEqual(code, await getInviteCode())) return fail(404, "This link isn't valid.");
  if (await isLocked()) return fail(423, "Letters are closed now.");

  const name = typeof b?.name === "string" ? b.name.trim().slice(0, 60) : "";
  const body = typeof b?.body === "string" ? b.body.trim() : "";
  if (!name) return fail(400, "Please add your name.");
  if (!body) return fail(400, "Write a few words first.");
  if (body.length > MAX_BODY) return fail(413, "That's a little long.");

  const r = await createJoined(name, body);
  if (!r.ok) {
    return r.reason === "full"
      ? fail(409, "All 22 letters are already in. Thank you for wanting to write one.")
      : fail(409, "A letter from that name has already been sent. If you're a different person with the same name, add an initial. If you need to change yours, ask the organiser.");
  }
  return json({ ok: true });
}
