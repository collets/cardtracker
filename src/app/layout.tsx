import type { Metadata } from "next";
import { connection } from "next/server";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { default: "Riftwatch", template: "%s · Riftwatch" },
  description: "Riftbound marketplace signals without the noise.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
