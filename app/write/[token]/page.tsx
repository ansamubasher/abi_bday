import Embers from "@/components/Embers";
import WriterClient from "@/components/WriterClient";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function WritePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="stage" style={{ alignItems: "start" }}>
      <div className="fog" />
      <Embers count={30} />
      <WriterClient token={token} heroName={site.heroName} />
    </main>
  );
}
