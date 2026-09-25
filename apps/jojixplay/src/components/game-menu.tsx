export function GameMenu({
  choosing,
  busy,
  onChoose,
  onBack,
  onPlay,
  onRace,
}: {
  choosing: boolean;
  busy: boolean;
  onChoose: () => void;
  onBack: () => void;
  onPlay: (players: 1 | 2) => void;
  onRace: () => void;
}) {
  return (
    <section class="game-menu" aria-labelledby="menu-title">
      <div class="menu-intro">
        <span class="menu-eyebrow">{choosing ? "DESENHAR" : "MENU PRINCIPAL"}</span>
        <h1 id="menu-title">{choosing ? "Quem vai brincar?" : "Vamos brincar?"}</h1>
        <p>Leve sua mão até um botão e espere o círculo completar.</p>
      </div>
      {choosing ? (
        <div class="game-shelf game-shelf--players">
          <button
            class="game-card game-card--draw"
            type="button"
            disabled={busy}
            onClick={() => onPlay(1)}
            aria-label="Desenhar sozinho"
          >
            <span class="card-art" aria-hidden="true">
              ☝
            </span>
            <strong>Sozinho</strong>
            <span>1 pessoa</span>
          </button>
          <button
            class="game-card game-card--duo"
            type="button"
            disabled={busy}
            onClick={() => onPlay(2)}
            aria-label="Desenhar em dupla"
          >
            <span class="card-art" aria-hidden="true">
              ✌
            </span>
            <strong>Em dupla</strong>
            <span>2 pessoas</span>
          </button>
          <button class="menu-return" type="button" disabled={busy} onClick={onBack}>
            ← Todos os jogos
          </button>
        </div>
      ) : (
        <ul class="game-shelf" aria-label="Jogos">
          <li>
            <button
              class="game-card game-card--draw"
              type="button"
              onClick={onChoose}
              disabled={busy}
              aria-label="Desenhar · 1 ou 2 pessoas"
            >
              <span class="card-art pencil-art" aria-hidden="true">
                ✎
              </span>
              <strong>Desenhar</strong>
              <span>1 ou 2 pessoas</span>
            </button>
          </li>
          <li>
            <button
              class="game-card game-card--race"
              type="button"
              disabled={busy}
              onClick={onRace}
              aria-label="Corrida dos Blocos · 1 pessoa"
            >
              <span class="card-art blocks-art" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <strong>Corrida dos Blocos</strong>
              <span>1 pessoa · pule, copie, agache!</span>
            </button>
          </li>
          {["✳"].map((symbol, index) => (
            <li class={`game-card game-card--soon game-card--soon-${index}`} key={symbol}>
              <span class="card-art" aria-hidden="true">
                {symbol}
              </span>
              <strong>Em breve</strong>
              <span>Mais brincadeiras por aqui</span>
            </li>
          ))}
        </ul>
      )}
      {busy ? (
        <p class="menu-busy" role="status">
          Preparando a brincadeira…
        </p>
      ) : null}
    </section>
  );
}
