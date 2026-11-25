import { fail, json } from "@/lib/api";
import { hasRole } from "@/lib/session";
import { letterForSlot } from "@/lib/letters";

const SAMPLE =
  "This is a preview letter. It appears because you entered through the organiser page. " +
  "The real letters are only ever shown to the birthday person.\n\n" +
  "Nothing here comes from any of the writers.";

export async function GET(_req: Request, ctx: { params: Promise<{ slot: string }> }) {
  const { slot: raw } = await ctx.params;
  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0 || slot > 21) return fail(404, "No such light.");

  if (await hasRole("hero")) {
    const l = await letterForSlot(slot);
    if (!l) {
      return json({
        slot,
        pending: true,
        from: "",
        body: "This light is still waiting for its letter.",
      });
    }
    return json({ slot, pending: false, from: l.from, body: l.body });
  }
  if (await hasRole("admin")) {
    return json({ slot, pending: false, from: "Preview", body: SAMPLE, preview: true });
  }
  return fail(401, "Not allowed.");
}
