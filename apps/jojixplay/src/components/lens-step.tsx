import type { CameraLens } from "../pose/camera-pose-controller";

/**
 * What to call each camera. Phones name them only by number and side ("camera 2, facing back"),
 * which says nothing about how wide each sees, so they are counted per side for the adult to try.
 */
export function lensNames(lenses: readonly CameraLens[]): string[] {
  const counts = { Frente: 0, Trás: 0, Câmera: 0 };
  return lenses.map(({ label }) => {
    const side = /front|user|frontal/i.test(label)
      ? "Frente"
      : /back|rear|environment|traseira/i.test(label)
        ? "Trás"
        : "Câmera";
    counts[side] += 1;
    return `${side} ${counts[side]}`;
  });
}

/**
 * The last thing an adult does by touch: with the camera's picture filling the screen, try each
 * camera and keep the one that shows the whole body in this room.
 */
export function LensStep({
  lenses,
  lensId,
  busy,
  error,
  onChoose,
  onDone,
  onCancel,
}: {
  lenses: readonly CameraLens[];
  lensId: string | null;
  busy: boolean;
  error: string | null;
  onChoose: (lens: CameraLens) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const names = lensNames(lenses);
  return (
    <section class="lens-step" aria-labelledby="lens-title">
      <h1 id="lens-title">Escolha a câmera que mostra o corpo inteiro</h1>
      {error ? (
        <p class="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <footer class="lens-footer">
        <div class="lens-choices" role="toolbar" aria-label="Câmera">
          {lenses.map((lens, index) => (
            <button
              key={lens.id}
              type="button"
              aria-pressed={lens.id === lensId}
              disabled={busy}
              onClick={() => onChoose(lens)}
            >
              {names[index]}
            </button>
          ))}
        </div>
        <button class="setup-cancel" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button class="setup-start" type="button" disabled={busy} onClick={onDone}>
          Começar
        </button>
      </footer>
    </section>
  );
}
