// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { PartsGallery } from "@/components/parts/parts-gallery";
import { PartsHero } from "@/components/parts/parts-hero";
import { publicParts } from "@/server/services/public-catalog";

export const metadata = { title: "Parts library" };

export default async function PartsPage() {
  const parts = (await publicParts()).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-2">
      <PartsHero count={parts.length} />
      <PartsGallery parts={parts} />
    </div>
  );
}
