import { useEffect, useMemo, useState } from "preact/hooks";
import { roleUrl, UnsupportedPanel } from "../components/unsupported-panel";
import { inspectPhoneCapabilities } from "../platform/capabilities";
import {
  deriveSessionCredentials,
  type PairingKey,
  type SessionCredentials,
} from "../session/credentials";
import { PhoneController } from "./phone-controller";

interface PhoneSessionProps {
  pairingKey: PairingKey;
}

type DerivationState =
  | { status: "loading" }
  | { status: "ready"; credentials: SessionCredentials }
  | { status: "error" };

export function PhoneSession({ pairingKey }: PhoneSessionProps) {
  const capabilities = useMemo(inspectPhoneCapabilities, []);
  const [derivation, setDerivation] = useState<DerivationState>({ status: "loading" });

  useEffect(() => {
    if (!capabilities.supported) {
      return;
    }
    let active = true;
    void deriveSessionCredentials(pairingKey)
      .then((credentials) => {
        if (active) {
          setDerivation({ status: "ready", credentials });
        }
      })
      .catch(() => {
        if (active) {
          setDerivation({ status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [capabilities.supported, pairingKey]);

  if (!capabilities.supported) {
    return <UnsupportedPanel device="phone" missing={capabilities.missing} />;
  }
  if (derivation.status === "ready") {
    return <PhoneController credentials={derivation.credentials} />;
  }
  if (derivation.status === "error") {
    return (
      <main class="page page--centered">
        <section class="panel" aria-labelledby="pairing-failed-title">
          <p class="eyebrow">Pairing failed</p>
          <h1 id="pairing-failed-title">The secure session could not be prepared.</h1>
          <p>Return to the TV, create a new session, and enter its new pairing key.</p>
          <a class="button button--secondary" href={roleUrl(null)}>
            Return to setup
          </a>
        </section>
      </main>
    );
  }
  return (
    <main class="page page--centered">
      <section class="panel" aria-live="polite">
        <p class="eyebrow">Securing session</p>
        <h1>Preparing your private connection…</h1>
      </section>
    </main>
  );
}
