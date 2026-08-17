import { useState } from "preact/hooks";
import { applicationModeUrl } from "../platform/application-mode";
import { formatPairingKeyInput, type PairingKey, parsePairingKey } from "../session/credentials";

interface PhonePairingPageProps {
  initialError: string | null;
  onPair: (pairingKey: PairingKey) => void;
}

export function PhonePairingPage({ initialError, onPair }: PhonePairingPageProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(initialError);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const result = parsePairingKey(input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onPair(result.value);
  };

  return (
    <main class="page page--centered">
      <section class="panel phone-pairing" aria-labelledby="pairing-title">
        <p class="eyebrow">Phone controller</p>
        <h1 id="pairing-title">Enter the key from your TV.</h1>
        <p>Type the 20-character key shown beside the QR code. Hyphens are added for you.</p>

        <form class="pairing-form" onSubmit={submit} noValidate>
          <label for="pairing-key">TV pairing key</label>
          <input
            id="pairing-key"
            name="pairing-key"
            value={input}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellcheck={false}
            maxLength={24}
            placeholder="M7PK-J3TD-W9HX-Q4FV-6R2C"
            aria-describedby="pairing-key-hint"
            aria-invalid={error !== null}
            onInput={(event) => {
              setInput(formatPairingKeyInput(event.currentTarget.value));
              setError(null);
            }}
          />
          <p id="pairing-key-hint" class="field-hint">
            Letters are not case-sensitive. Similar-looking O, I, and L are accepted.
          </p>
          {error !== null ? (
            <p class="inline-error" role="alert">
              {error}
            </p>
          ) : null}
          <button class="button button--primary" type="submit">
            Connect to TV
          </button>
        </form>

        <p class="pairing-alternative">You can still scan the QR code instead.</p>
        <a class="text-button" href={applicationModeUrl(null)}>
          Return to setup
        </a>
      </section>
    </main>
  );
}
