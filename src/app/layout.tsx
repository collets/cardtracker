import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { default: "Riftwatch", template: "%s · Riftwatch" },
  description: "Riftbound marketplace signals without the noise.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
