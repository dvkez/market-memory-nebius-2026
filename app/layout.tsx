import type { Metadata } from "next";
import "./globals.css";
import "./session.css";

export const metadata: Metadata = {
  title: "Market Memory — Research with a longer view",
  description: "Evidence-led market research with persistent memory. Powered by NVIDIA Nemotron on Nebius and Tavily.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
