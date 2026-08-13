import { InvalidPairingPage } from "./pages/invalid-pairing-page";
import { LandingPage } from "./pages/landing-page";
import { PhoneController } from "./pages/phone-controller";
import { TvDisplay } from "./pages/tv-display";
import { parseSessionFragment } from "./session/credentials";

export function App() {
  const role = new URLSearchParams(window.location.search).get("role");
  if (role === "tv") {
    return <TvDisplay />;
  }
  if (role === "phone") {
    const credentials = parseSessionFragment(window.location.hash);
    if (!credentials.ok) {
      return <InvalidPairingPage message={credentials.error} />;
    }
    return <PhoneController credentials={credentials.value} />;
  }
  return <LandingPage />;
}
