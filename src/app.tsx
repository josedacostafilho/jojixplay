import { useEffect, useState } from "preact/hooks";
import { LocalPlayPage } from "./pages/local-play-page";

function isLandscape(): boolean {
  return (
    window.matchMedia("(orientation: landscape)").matches &&
    (window.screen.orientation === undefined ||
      window.screen.orientation.type.startsWith("landscape"))
  );
}

export function App() {
  const [landscape, setLandscape] = useState(isLandscape);
  useEffect(() => {
    const query = window.matchMedia("(orientation: landscape)");
    const update = () => setLandscape(isLandscape());
    query.addEventListener("change", update);
    window.screen.orientation?.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
      window.screen.orientation?.removeEventListener("change", update);
    };
  }, []);

  if (window.location.search !== "" || window.location.hash !== "") {
    return (
      <main class="page page--centered">
        <section class="panel">
          <h1>Open JojixPlay on your phone.</h1>
          <p role="alert">This link is invalid. Open the website without a query or fragment.</p>
          <a class="button button--primary" href={import.meta.env.BASE_URL}>
            Open JojixPlay
          </a>
        </section>
      </main>
    );
  }

  return landscape ? (
    <LocalPlayPage />
  ) : (
    <main class="page page--centered rotate-screen">
      <section class="panel" aria-labelledby="rotate-title">
        <p class="eyebrow">JojixPlay</p>
        <span class="rotate-phone" aria-hidden="true">
          ↻
        </span>
        <h1 id="rotate-title">Rotate your phone</h1>
        <p>Turn your phone sideways to landscape to play. Keep screen rotation enabled.</p>
        <p>Mirror your phone screen to your TV for a bigger playground.</p>
      </section>
    </main>
  );
}
