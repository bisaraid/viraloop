import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ViraLoop — AI Content Script & Voice Generator",
  description: "Generate script video pendek + konversi ke suara dengan AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-[var(--border)] px-6 py-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <h1 className="text-xl font-bold gradient-text">ViraLoop</h1>
              <span className="text-sm text-[var(--muted-foreground)]">AI Content Script + Voice Generator</span>
            </div>
          </header>
          <main className="flex-1 px-6 py-8">
            <div className="max-w-3xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}