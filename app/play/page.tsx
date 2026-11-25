import { redirect } from "next/navigation";
import GameShell from "@/components/GameShell";
import { hasRole } from "@/lib/session";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const hero = await hasRole("hero");
  const admin = await hasRole("admin");
  if (!hero && !admin) redirect("/");
  return (
    <GameShell
      heroName={site.heroName}
      title={site.title}
      birthday={site.birthdayLabel}
      age={site.turningAge}
      preview={!hero}
    />
  );
}
