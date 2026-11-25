import { json, requireAdmin } from "@/lib/api";
import { getInviteCode, isLocked, letterMeta, listWriters, MAX_WRITERS } from "@/lib/letters";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const writers = await listWriters();
  const rows = await Promise.all(
    writers.map(async (w) => ({
      id: w.id,
      slot: w.slot,
      name: w.name,
      ...(await letterMeta(w.id)), // organiser sees status + word count, never the text
    }))
  );
  return json({ locked: await isLocked(), max: MAX_WRITERS, invite: await getInviteCode(), writers: rows });
}
