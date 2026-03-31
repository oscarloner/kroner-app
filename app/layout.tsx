import type { Metadata, Viewport } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Kroner",
  description: "Personlig økonomiapp migrert til Next.js + Supabase",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kroner"
  },
  icons: {
    apple: "/appicon.png",
    shortcut: "/appicon.png",
    icon: [
      { url: "/appicon.png", sizes: "192x192", type: "image/png" },
      { url: "/splashicon.png", sizes: "512x512", type: "image/png" }
    ]
  }
};

export const viewport: Viewport = {
  themeColor: "#f7f6f3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
