import Embers from "@/components/Embers";
import UnlockForm from "@/components/UnlockForm";
import { hasRole } from "@/lib/session";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function Home() {
  const signedIn = await hasRole("hero");
  return (
    <main className="stage">
      <div className="fog" />
      <Embers />
      <div className="panel">
        <div className="lantern" />
        <div className="eyebrow">for {site.heroName}</div>
        <h1 className="title">{site.title}</h1>
        <p className="sub">{site.tagline}</p>
        <UnlockForm signedIn={signedIn} heroName={site.heroName} />
        <p className="note" style={{ marginTop: 34 }}>
          Best on a laptop, with a keyboard and sound. About 40 minutes.
        </p>
      </div>
    </main>
  );
}
