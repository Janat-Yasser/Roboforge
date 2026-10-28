import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { currentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Public pages must render even when the database is unavailable.
  const user = await currentUser().catch(() => null);
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader signedIn={!!user} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
