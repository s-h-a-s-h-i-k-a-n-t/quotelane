import Link from "next/link";
import type { ReactNode } from "react";

export function QuoteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="quote-shell">
      <header className="quote-header">
        <Link href="/" prefetch={false} className="quote-brand">QuoteLane</Link>
      </header>
      <main className="quote-main">
        <section className="quote-card">{children}</section>
      </main>
    </div>
  );
}
