// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Landing } from "@/components/site/landing/landing";
import { currentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Public landing page. */
export default async function LandingPage() {
  const signedIn = !!(await currentUser().catch(() => null));
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader signedIn={signedIn} />
      <main className="flex-1">
        <Landing signedIn={signedIn} />
      </main>
      <SiteFooter />
    </div>
  );
}
