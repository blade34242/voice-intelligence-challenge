import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Everlast Voice Intelligence",
  description: "Voice transcription overlay"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
