import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BAKNUS AI – Asisten Belajar Cerdas SMK",
  description:
    "BAKNUS AI adalah asisten belajar berbasis kecerdasan buatan untuk siswa dan guru SMK Bakti Nusantara 666. Powered by AI.",
  keywords: ["BaknusAI", "asisten belajar", "SMK", "AI", "chatbot sekolah"],
  authors: [{ name: "SMK Bakti Nusantara 666" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#212121",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
