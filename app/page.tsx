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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="portrait" src="/hero/face.png" alt="" />
        <div className="eyebrow">for {site.heroName}</div>
        <h1 className="title">{site.title}</h1>
        <p className="sub">{site.tagline}</p>
        <UnlockForm signedIn={signedIn} heroName={site.heroName} />
        <p className="note" style={{ marginTop: 34 }}>
          Best on a laptop, with a keyboard and sound. A few minutes of play, plus the letters.
        </p>
        <p className="note" style={{ marginTop: 6, opacity: 0.55 }}>{site.fanNote}</p>
      </div>
    </main>
  );
}
