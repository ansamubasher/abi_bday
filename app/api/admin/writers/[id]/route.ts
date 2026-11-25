import { fail, json, readJson, requireAdmin } from "@/lib/api";
import { deleteWriter, updateWriter } from "@/lib/letters";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const b = await readJson<{ name?: string; regen?: boolean }>(req);
  const w = await updateWriter(id, { name: b?.name, regen: b?.regen === true });
  return w ? json({ ok: true }) : fail(404, "No such writer.");
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  await deleteWriter(id);
  return json({ ok: true });
}
