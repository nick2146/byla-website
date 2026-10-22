import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BYLA Markets | Paper Trading Simulator",
  description: "Learn how markets work with virtual money. No real money or brokerage account required.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
