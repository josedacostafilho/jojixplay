import { useEffect, useMemo, useState } from "preact/hooks";
import { LandingPage } from "./pages/landing-page";
import { PhonePairingPage } from "./pages/phone-pairing-page";
import { PhoneSession } from "./pages/phone-session";
import { TvDisplay } from "./pages/tv-display";
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
  const role = new URLSearchParams(window.location.search).get("role");
  if (role === "tv") {
    return <TvDisplay />;
  }
  if (role === "phone") {
    return <PhoneRoute />;
  }
  return <LandingPage />;
}
