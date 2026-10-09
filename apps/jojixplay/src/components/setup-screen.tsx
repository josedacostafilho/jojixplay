import type { ComponentChildren } from "preact";

function Step({
  title,
  children,
  icon,
}: {
  title: string;
  children: ComponentChildren;
  icon: ComponentChildren;
}) {
  return (
    <li class="setup-step">
      <svg
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {icon}
      </svg>
      <strong>{title}</strong>
      <span>{children}</span>
    </li>
  );
}

/** The one screen an adult uses with the phone in hand. Everything after it is done by moving. */
export function SetupScreen({
  starting,
  error,
  onStart,
  onCancel,
}: {
  starting: boolean;
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <section class="setup" aria-labelledby="setup-title">
      <header class="setup-header">
        <span class="brand">
          jojix<span>play</span>
        </span>
        <h1 id="setup-title">Prepare a brincadeira</h1>
      </header>
      <ol class="setup-steps">
        <Step
          title="Espelhe na TV"
          icon={
            <>
              <rect x="8" y="16" width="84" height="52" rx="8" />
              <path d="M36 86 L64 86 M50 68 L50 86" />
            </>
          }
        >
          Use o espelhamento de tela do celular ou um cabo.
        </Step>
        <Step
          title="Apoie o celular deitado"
          icon={
            <>
              <rect x="14" y="34" width="72" height="38" rx="8" />
              <circle cx="72" cy="53" r="4" />
              <path d="M30 86 L22 72 M70 86 L78 72" />
            </>
          }
        >
          Perto da TV, firme, com a câmera virada para a sala.
        </Step>
        <Step
          title="Abra espaço"
          icon={
            <>
              <circle cx="50" cy="18" r="10" />
              <path d="M50 28 L50 60 M50 38 L28 26 M50 38 L72 26 M50 60 L36 88 M50 60 L64 88" />
            </>
          }
        >
          Fique a uns dois passos, com o corpo aparecendo.
        </Step>
      </ol>
      <footer class="setup-footer">
        {error ? (
          <p class="inline-error" role="alert">
            {error}
          </p>
        ) : (
          <p class="setup-privacy">
            A imagem da câmera fica só neste celular. Nada é gravado nem enviado.
          </p>
        )}
        {starting ? (
          <button class="setup-cancel" type="button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
        <button class="setup-start" type="button" disabled={starting} onClick={onStart}>
          {starting ? "Abrindo a câmera…" : "Ligar a câmera"}
        </button>
      </footer>
    </section>
  );
}
