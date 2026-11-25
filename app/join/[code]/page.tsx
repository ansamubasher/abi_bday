import Embers from "@/components/Embers";
import JoinClient from "@/components/JoinClient";
import { safeEqual } from "@/lib/crypto";
import { MAX_WRITERS, getInviteCode, isLocked, listWriters } from "@/lib/letters";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The one link the organiser shares with all friends. It only lets someone write their own letter. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const valid = !!code && safeEqual(code, await getInviteCode());
  return (
    <main className="stage" style={{ alignItems: "start" }}>
      <div className="fog" />
      <Embers count={30} />
      {valid ? (
        <JoinClient
          code={code}
          heroName={site.heroName}
          closed={await isLocked()}
          full={(await listWriters()).length >= MAX_WRITERS}
        />
      ) : (
        <div className="panel">
          <h1 className="title" style={{ fontSize: 40 }}>This link doesn't work.</h1>
          <p className="sub">Ask whoever sent it for the current one.</p>
        </div>
      )}
    </main>
  );
}
