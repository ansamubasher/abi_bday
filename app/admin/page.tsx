import Embers from "@/components/Embers";
import AdminClient from "@/components/AdminClient";
import { hasRole } from "@/lib/session";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const signedIn = await hasRole("admin");
  return (
    <main className="stage" style={{ alignItems: "start" }}>
      <div className="fog" />
      <Embers count={25} />
      <AdminClient signedIn={signedIn} heroName={site.heroName} />
    </main>
  );
}
