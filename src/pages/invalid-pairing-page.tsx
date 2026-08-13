import { roleUrl } from "../components/unsupported-panel";

interface InvalidPairingPageProps {
  message: string;
}

export function InvalidPairingPage({ message }: InvalidPairingPageProps) {
  return (
    <main class="page page--centered">
      <section class="panel invalid-pairing" aria-labelledby="invalid-title">
        <p class="eyebrow">Pairing required</p>
        <h1 id="invalid-title">Open the link from your TV.</h1>
        <p>{message}</p>
        <p>
          On the TV, choose <strong>Open on the TV</strong>, then scan its new QR code with this
          phone.
        </p>
        <a class="button button--secondary" href={roleUrl(null)}>
          Return to setup
        </a>
      </section>
    </main>
  );
}
