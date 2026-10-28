"use client";
import { HeroCarousel } from "./hero-carousel";
import { Audiences, FeatureGrid, FinalCta, HowItWorks, LearnTeaser, Live3D, ProjectCarousel, WorksWith } from "./sections";

export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <HeroCarousel signedIn={signedIn} />
      <WorksWith />
      <HowItWorks />
      <Live3D />
      <ProjectCarousel />
      <Audiences />
      <FeatureGrid />
      <LearnTeaser />
      <FinalCta signedIn={signedIn} />
    </>
  );
}
