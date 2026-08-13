import { roleUrl } from "../components/unsupported-panel";

export function LandingPage() {
  return (
    <main class="landing">
      <header class="landing__header">
        <a class="brand" href={roleUrl(null)} aria-label="Jojixplay home">
          <span class="brand__mark" aria-hidden="true">
            J
          </span>
          <span>jojixplay</span>
        </a>
        <span class="prototype-label">Skeleton prototype</span>
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

        <section class="role-grid" aria-labelledby="role-choice-title">
          <h2 id="role-choice-title" class="visually-hidden">
            Choose this device's role
          </h2>
          <a class="role-card role-card--tv" href={roleUrl("tv")}>
            <span class="role-card__number" aria-hidden="true">
              01
            </span>
            <span class="role-card__icon" aria-hidden="true">
              ▰
            </span>
            <span class="role-card__title">Open on the TV</span>
            <span class="role-card__description">
              Show the pairing QR and render the live skeleton.
            </span>
            <span class="role-card__action">
              Set up display <span aria-hidden="true">→</span>
            </span>
          </a>

          <a class="role-card role-card--phone" href={roleUrl("phone")}>
            <span class="role-card__number" aria-hidden="true">
              02
            </span>
            <span class="role-card__icon role-card__icon--phone" aria-hidden="true">
              ▯
            </span>
            <span class="role-card__title">Open on the phone</span>
            <span class="role-card__description">
              Normally you arrive here by scanning the TV's QR code.
            </span>
            <span class="role-card__action">
              Check pairing link <span aria-hidden="true">→</span>
            </span>
          </a>
        </section>
      </section>

      <footer class="landing__footer">
        <span>Static. Peer to peer. No account.</span>
        <span>Early greenfield prototype</span>
      </footer>
    </main>
  );
}
