import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BYLA Markets | Paper Trading Simulator",
  description: "BYLA Markets is the Business Youth Leadership Association virtual stock market simulator. Learn investing with virtual money.",
  icons: { icon: "/byla-markets-logo.svg", shortcut: "/byla-markets-logo.svg", apple: "/byla-markets-logo.svg" },
  openGraph: { title: "BYLA Markets | Paper Trading Simulator", description: "Practice investing with virtual money on BYLA Markets.", images: ["/byla-markets-logo.svg"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
