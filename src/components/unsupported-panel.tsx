import { applicationModeUrl } from "../platform/application-mode";

interface UnsupportedPanelProps {
  device: "phone" | "television";
  missing: string[];
}

export function UnsupportedPanel({ device, missing }: UnsupportedPanelProps) {
  return (
    <main class="page page--centered">
      <section class="panel unsupported-panel" aria-labelledby="unsupported-title">
        <p class="eyebrow">Unsupported device</p>
        <h1 id="unsupported-title">This {device} cannot run the prototype.</h1>
        <p>
          Jojixplay uses a deliberately modern browser baseline and does not ship compatibility
          fallbacks.
        </p>
        <p class="missing-label">Missing capabilities:</p>
        <ul class="missing-list">
          {missing.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
        <a class="button button--secondary" href={applicationModeUrl(null)}>
          Return to setup
        </a>
      </section>
    </main>
  );
}
