import type { Metadata, Viewport } from "next";
// System fonts only: nothing to download, so the demo works on venue Wi-Fi or fully offline.
import "./globals.css";

export const metadata: Metadata = {
  title: "Pedhi",
  description: "The AI munim for family businesses: sales, stock, udhaar and a daily brief across every branch.",
  appleWebApp: { capable: true, title: "Pedhi", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = {
  viewportFit: "cover", // lets the installed app draw under the notch; safe-area padding keeps content clear
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f3f0" }, { media: "(prefers-color-scheme: dark)", color: "#131312" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
