interface StatusPillProps {
  tone: "neutral" | "active" | "warning" | "danger";
  children: string;
}

export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span class={`status-pill status-pill--${tone}`} role="status" aria-live="polite">
      <span class="status-pill__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
