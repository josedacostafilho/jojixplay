interface UnsupportedPanelProps {
  missing: string[];
}

export function UnsupportedPanel({ missing }: UnsupportedPanelProps) {
  return (
    <main class="page page--centered">
      <section class="panel unsupported-panel" aria-labelledby="unsupported-title">
        <p class="eyebrow">Uma ajudinha de um adulto</p>
        <h1 id="unsupported-title">Vamos tentar outro navegador?</h1>
        <p>
          Este navegador não consegue abrir a brincadeira. Use um navegador atualizado no celular e
          abra o endereço seguro do site diretamente.
        </p>
        <p class="missing-label">Recursos indisponíveis:</p>
        <ul class="missing-list">
          {missing.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
        <a class="button button--secondary" href={import.meta.env.BASE_URL}>
          Voltar ao início
        </a>
      </section>
    </main>
  );
}
