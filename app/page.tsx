import React from 'react';

export default function HomePage() {
  return (
    <>
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="/videos/purple_button_blk.mp4" type="video/mp4" />
        <source src="/videos/purple_button_3sec.mov" type="video/quicktime" />
      </video>
      <main className="landing">
        <section className="landing-hero">
          <div className="landing-title-frame" aria-hidden="true">
            <h1 className="landing-title"></h1>
          </div>
          <a className="landing-cta" href="/api/auth/login?redirect=/adventure">
            connect to spotify
          </a>
        </section>
      </main>
    </>
  );
}
