import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="app-shell">
      <a href="/" className="text-sm text-muted">
        Tillbaka
      </a>
      <h1 className="mt-6 font-display text-3xl tracking-tight italic">{title}</h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">{children}</div>
    </main>
  );
}
