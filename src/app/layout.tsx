import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Form router | DecisionNode",
  description: "Form submissions routed to the right team: DecisionNode Flash first, DecisionNode when Flash is unsure.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-black text-white">{children}</body>
    </html>
  );
}
