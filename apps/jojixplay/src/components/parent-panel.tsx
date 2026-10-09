import { isFresh } from "@jojixplay/game-sdk";
import { useRef } from "preact/hooks";
import type { BodyFrameSource } from "../pose/body-frame-source";
import { usePolled } from "./use-polled";

const SCROLL_STEP_PX = 120;

function Diagnostic({ frames }: { frames: BodyFrameSource }) {
  const text = usePolled(() => {
    const now = performance.now();
    const frame = frames.latest();
    if (!frame) return "Aguardando movimentos · Sem movimento recente";
    const people = frame.bodies.length;
    return `${Math.round(now - frame.capturedAtMs)} ms desde a captura · ${
      isFresh(frame, now)
        ? `${people} ${people === 1 ? "pessoa detectada" : "pessoas detectadas"}`
        : "Sem movimento recente"
    }`;
  }, 500);
  return <p class="diagnostic">Teste de movimento · {text}</p>;
}

/** Setup guidance for the adult. `frames` is present only while the camera is tracking. */
export function ParentPanel({
  frames,
  onClose,
}: {
  frames: BodyFrameSource | null;
  onClose: () => void;
}) {
  const steps = useRef<HTMLOListElement>(null);
  const scroll = (top: number) => steps.current?.scrollBy({ top, behavior: "smooth" });
  return (
    <section class="parent-panel" aria-label="Orientações para os adultos">
      <div class="parent-heading">
        <h2>Uma ajudinha sua</h2>
        <button
          class="quiet-button"
          type="button"
          onClick={onClose}
          aria-label="Fechar orientações"
        >
          Fechar ×
        </button>
      </div>
      <div class="parent-scroll-controls">
        <button type="button" onClick={() => scroll(-SCROLL_STEP_PX)}>
          ↑ Subir
        </button>
        <button type="button" onClick={() => scroll(SCROLL_STEP_PX)}>
          ↓ Ler mais
        </button>
      </div>
      <ol ref={steps}>
        <li>
          <strong>Prepare um espacinho.</strong> Apoie o celular em um lugar firme, de frente para a
          criança. No Desenhar, deixe ombros e mãos visíveis. Na Corrida dos Blocos, tente mostrar
          também as pernas e os pés.
        </li>
        <li>
          <strong>Leve para a TV.</strong> Espelhe a tela usando os controles do celular ou um cabo.
          A brincadeira continua rodando no celular.
        </li>
        <li>
          <strong>Participe.</strong> Escolha Desenhar e depois Sozinho ou Em dupla. Não é preciso
          ter a mesma altura. Vocês podem desenhar juntos, cada um de um lado.
        </li>
        <li>
          <strong>Hora de desenhar.</strong> Uma mão conduz o pincel. Levante a outra acima do ombro
          para pintar e abaixe para parar. Em dupla, cada pessoa fica de um lado. As cores podem ser
          escolhidas mantendo o pincel sobre elas até o círculo completar. Menus, voltar e
          confirmações também funcionam com a mão.
        </li>
        <li>
          <strong>Corra entre os blocos.</strong> Corrida dos Blocos é para uma pessoa. Vá para o
          meio e fique agachado durante a contagem. Pule barreiras, copie os braços do muro e agache
          sob as traves. Cada fase renova os três corações. Mova a mão até Pausa, Como jogar ou
          Voltar quando precisar.
        </li>
      </ol>
      <p>
        Sua câmera aparece nos menus. As imagens ficam neste celular: não gravamos nem enviamos.
      </p>
      {frames ? <Diagnostic frames={frames} /> : null}
    </section>
  );
}
