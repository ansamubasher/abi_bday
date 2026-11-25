import { json, readJson, requireAdmin } from "@/lib/api";
import { setLocked } from "@/lib/letters";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await readJson<{ locked?: boolean }>(req);
  await setLocked(b?.locked === true);
  return json({ ok: true });
}
