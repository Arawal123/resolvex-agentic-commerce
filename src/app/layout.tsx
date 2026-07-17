import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ResolveX — Explainable Autonomous Commerce",
    template: "%s · ResolveX",
  },
  description:
    "An explainable autonomous e-commerce operations agent that investigates, acts, verifies, and produces contestable decision records.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: { title: "ResolveX", description: "Autonomy you can interrogate.", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
