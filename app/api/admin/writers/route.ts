import { fail, json, readJson, requireAdmin } from "@/lib/api";
import { createWriters } from "@/lib/letters";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await readJson<{ names?: string[] }>(req);
  const names = Array.isArray(b?.names) ? b!.names.map(String) : [];
  if (!names.length) return fail(400, "Give at least one name.");
  await createWriters(names);
  return json({ ok: true });
}
