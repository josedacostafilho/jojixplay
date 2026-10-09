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

  return landscape ? (
    <LocalPlayPage />
  ) : (
    <main class="page">
      <section class="panel" aria-labelledby="rotate-title">
        <svg
          class="rotate-phone"
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          stroke-width="6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="34" y="10" width="32" height="56" rx="7" opacity="0.45" />
          <rect x="22" y="56" width="56" height="32" rx="7" />
          <path d="M74 20 Q90 26 88 46 M88 46 L80 40 M88 46 L94 37" />
        </svg>
        <h1 id="rotate-title">Vire o celular</h1>
        <p>Deixe o celular deitado para brincar, com a rotação automática ativada.</p>
      </section>
    </main>
  );
}
