import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pickleball Availability Buddy",
  description: "Read-only cached pickleball venue availability with shareable pages.",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className="dark" lang="en">
      <body>{children}</body>
    </html>
  );
}
