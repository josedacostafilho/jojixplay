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
    <main class="page page--centered rotate-screen">
      <section class="panel" aria-labelledby="rotate-title">
        <p class="eyebrow">JojixPlay</p>
        <span class="rotate-phone" aria-hidden="true">
          ↻
        </span>
        <h1 id="rotate-title">Vire o celular</h1>
        <p>Deixe o celular deitado para brincar. Mantenha a rotação automática ativada.</p>
        <p>Espelhe a tela do celular na TV para brincar em uma tela maior.</p>
      </section>
    </main>
  );
}
