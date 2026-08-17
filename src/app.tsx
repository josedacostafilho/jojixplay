import { useEffect, useMemo, useState } from "preact/hooks";
import { LandingPage } from "./pages/landing-page";
import { LocalPlayPage } from "./pages/local-play-page";
import { PhonePairingPage } from "./pages/phone-pairing-page";
import { PhoneSession } from "./pages/phone-session";
import { TvDisplay } from "./pages/tv-display";
import { applicationModeUrl, parseApplicationMode } from "./platform/application-mode";
import { type PairingKey, parsePairingKeyFragment } from "./session/credentials";

function PhoneRoute() {
  const initialPairing = useMemo(
    () => (window.location.hash === "" ? null : parsePairingKeyFragment(window.location.hash)),
    [],
  );
  const [enteredKey, setEnteredKey] = useState<PairingKey | null>(null);
  const pairingKey = enteredKey ?? (initialPairing?.ok ? initialPairing.value : null);

  useEffect(() => {
    if (window.location.hash === "") {
      return;
    }
    const scrubbedUrl = new URL(window.location.href);
    scrubbedUrl.hash = "";
    window.history.replaceState(null, "", scrubbedUrl);
  }, []);

  return pairingKey === null ? (
    <PhonePairingPage
      initialError={initialPairing !== null && !initialPairing.ok ? initialPairing.error : null}
      onPair={setEnteredKey}
    />
  ) : (
    <PhoneSession pairingKey={pairingKey} />
  );
}

export function App() {
  const mode = parseApplicationMode(window.location.search);
  if (!mode.ok) {
    return (
      <main class="page page--centered">
        <section class="panel" aria-labelledby="invalid-link-title">
          <p class="eyebrow">Invalid application link</p>
          <h1 id="invalid-link-title">Choose a current JojixPlay mode.</h1>
          <p role="alert">{mode.error}</p>
          <a class="button button--secondary" href={applicationModeUrl(null)}>
            Return to setup
          </a>
        </section>
      </main>
    );
  }
  if (mode.value === "tv") {
    return <TvDisplay />;
  }
  if (mode.value === "phone") {
    return <PhoneRoute />;
  }
  if (mode.value === "local") {
    return <LocalPlayPage />;
  }
  return <LandingPage />;
}
