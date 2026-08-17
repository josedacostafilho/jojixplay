import { applicationModeUrl } from "../platform/application-mode";

export function LandingPage() {
  return (
    <main class="landing">
      <header class="landing__header">
        <a class="brand" href={applicationModeUrl(null)} aria-label="Jojixplay home">
          <span class="brand__mark" aria-hidden="true">
            J
          </span>
          <span>jojixplay</span>
        </a>
        <span class="prototype-label">Body-control prototype</span>
      </header>

      <section class="hero" aria-labelledby="hero-title">
        <div class="hero__copy">
          <p class="eyebrow">Your body is the controller</p>
          <h1 id="hero-title">Turn a phone and TV into a motion playground.</h1>
          <p class="hero__lede">
            Your phone sees movement and sends only pose landmarks directly to your TV. Camera
            pixels stay on the phone.
          </p>
        </div>

        <section class="mode-grid" aria-labelledby="mode-choice-title">
          <h2 id="mode-choice-title" class="visually-hidden">
            Choose how this device will run JojixPlay
          </h2>
          <a class="mode-card mode-card--tv" href={applicationModeUrl("tv")}>
            <span class="mode-card__number" aria-hidden="true">
              01
            </span>
            <span class="mode-card__icon" aria-hidden="true">
              ▰
            </span>
            <span class="mode-card__title">Open on the TV</span>
            <span class="mode-card__description">
              Show the pairing QR and manual key, then render the live body avatar.
            </span>
            <span class="mode-card__action">
              Set up display <span aria-hidden="true">→</span>
            </span>
          </a>

          <a class="mode-card mode-card--phone" href={applicationModeUrl("phone")}>
            <span class="mode-card__number" aria-hidden="true">
              02
            </span>
            <span class="mode-card__icon mode-card__icon--phone" aria-hidden="true">
              ▯
            </span>
            <span class="mode-card__title">Open on the phone</span>
            <span class="mode-card__description">
              Scan the TV's QR code or enter its 20-character pairing key.
            </span>
            <span class="mode-card__action">
              Enter pairing key <span aria-hidden="true">→</span>
            </span>
          </a>

          <a class="mode-card mode-card--local" href={applicationModeUrl("local")}>
            <span class="mode-card__number" aria-hidden="true">
              03
            </span>
            <span class="mode-card__icon mode-card__icon--local" aria-hidden="true">
              ◉
            </span>
            <span class="mode-card__title">Play on this phone</span>
            <span class="mode-card__description">
              Run body tracking and the complete games here, with optional screen mirroring.
            </span>
            <span class="mode-card__action">
              Start local play <span aria-hidden="true">→</span>
            </span>
          </a>
        </section>
      </section>

      <footer class="landing__footer">
        <span>Static. Local or peer to peer. No account.</span>
        <span>Early greenfield prototype</span>
      </footer>
    </main>
  );
}
