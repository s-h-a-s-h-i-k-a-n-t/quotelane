import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuoteLane | Auto insurance quotes",
  description: "Request auto insurance quotes with QuoteLane.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
