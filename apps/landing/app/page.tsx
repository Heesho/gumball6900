import { SimsDriver } from '../components/SimsDriver';
import { Hero, Masthead } from '../components/sections/Hero';
import { Plate } from '../components/sections/Plate';
import { Overview } from '../components/sections/Overview';
import { Mining } from '../components/sections/Mining';
import { Resonance } from '../components/sections/Resonance';
import { Fund } from '../components/sections/Fund';
import { Extras } from '../components/sections/Extras';
import { Why } from '../components/sections/Why';
import { Close } from '../components/sections/Close';

export default function LandingPage() {
  return (
    <>
      <Masthead />
      <main>
        <Hero />
        <Plate />
        <Overview />
        <Mining />
        <Resonance />
        <Fund />
        <Extras />
        <Why />
        <Close />
      </main>
      <SimsDriver />
    </>
  );
}
