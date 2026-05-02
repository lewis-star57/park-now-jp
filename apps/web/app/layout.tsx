import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Park Now JP — 今すぐ停められるパーキングメーター",
  description:
    "今この瞬間、停められるか？が一目でわかる、日本全国対応のパーキングメーター PWA",
  applicationName: "Park Now JP",
  appleWebApp: {
    capable: true,
    title: "Park Now JP",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased bg-bg text-text">{children}</body>
    </html>
  );
}
