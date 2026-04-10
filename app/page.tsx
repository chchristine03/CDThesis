import React from 'react';
import { LandingScrollLock } from './landing-scroll-lock';

export default function HomePage() {
  return (
    <>
      <LandingScrollLock />
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="/videos/landing_title_stay.mp4" type="video/mp4" />
      </video>
      <main className="landing">
        <section className="landing-hero">
          <div className="landing-title-frame" aria-hidden="true">
            <h1 className="landing-title"></h1>
          </div>
          <a className="landing-cta" href="/api/auth/login?redirect=/adventure">
            enter
          </a>
        </section>
      </main>
    </>
  );
}
