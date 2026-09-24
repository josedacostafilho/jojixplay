interface UnsupportedPanelProps {
  missing: string[];
}

export function UnsupportedPanel({ missing }: UnsupportedPanelProps) {
  return (
    <main class="page page--centered">
      <section class="panel unsupported-panel" aria-labelledby="unsupported-title">
        <p class="eyebrow">A hand from your grown-up</p>
        <h1 id="unsupported-title">Let’s try another browser.</h1>
        <p>
          This browser cannot open the movement check. Try an up-to-date browser on your phone, and
          open the secure website directly.
        </p>
        <p class="missing-label">Missing capabilities:</p>
        <ul class="missing-list">
          {missing.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
        <a class="button button--secondary" href={import.meta.env.BASE_URL}>
          Return to setup
        </a>
      </section>
    </main>
  );
}
