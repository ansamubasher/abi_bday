import { json, requireAdmin } from "@/lib/api";
import { isLocked, letterMeta, listWriters, writerToken, MAX_WRITERS } from "@/lib/letters";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const writers = await listWriters();
  const rows = await Promise.all(
    writers.map(async (w) => ({
      id: w.id,
      slot: w.slot,
      name: w.name,
      token: writerToken(w),
      ...(await letterMeta(w.id)), // organiser sees status + word count, never the text
    }))
  );
  return json({ locked: await isLocked(), max: MAX_WRITERS, writers: rows });
}
