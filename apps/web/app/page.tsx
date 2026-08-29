import { CinematicHero } from '../components/home/cinematic-hero';
import { ClosingSection } from '../components/home/closing-section';
import { FinaleSection } from '../components/home/finale-section';
import { MechanismDashboard } from '../components/home/mechanism-dashboard';
import { WhatItIsSection } from '../components/home/what-it-is-section';

/**
 * Four beats and no more: the film, what this is, the thing running, and where to read the rest.
 *
 * The page had grown to twelve sections and three and a half thousand words, and told the same
 * story three times over — once in prose, once in a diagram, and once in the boards. The boards do
 * it best, so they keep it. Everything a reader might want after that is in the whitepaper, and
 * this page's job is only to make them want it.
 */
export default function HomePage() {
  return (
    <>
      <CinematicHero />
      <div className="page-body">
        <WhatItIsSection />
        <MechanismDashboard />
        <FinaleSection />
        <ClosingSection />
      </div>
    </>
  );
}
