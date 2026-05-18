import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Total Recall",
  description: "Personal photo intelligence layer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-950 text-white">{children}</body>
    </html>
  );
}
