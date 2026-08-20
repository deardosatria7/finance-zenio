import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Dasar untuk URL absolut Open Graph/Twitter. NEXT_PUBLIC_SITE_URL harus
  // tersedia saat build (lihat ARG di Dockerfile), bukan hanya saat runtime.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
  ),
  title: {
    default: "Finance Zenio – Catat Keuangan Pribadi",
    template: "%s | Finance Zenio",
  },
  description:
    "Finance Zenio adalah aplikasi pencatatan keuangan pribadi yang mudah digunakan. Catat pemasukan dan pengeluaran, pantau saldo, dan kelola anggaran harianmu dengan cepat.",
  keywords: [
    "aplikasi keuangan",
    "catat keuangan",
    "pencatatan pemasukan pengeluaran",
    "finance tracker",
    "manajemen keuangan pribadi",
    "anggaran harian",
    "zenio",
  ],
  authors: [{ name: "Zenio" }],
  creator: "Zenio",
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "Finance Zenio",
    title: "Finance Zenio – Catat Keuangan Pribadi",
    description:
      "Catat pemasukan dan pengeluaran dengan mudah. Pantau saldo dan kelola anggaran harianmu bersama Finance Zenio.",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "Finance Zenio – Aplikasi Pencatatan Keuangan Pribadi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Finance Zenio – Catat Keuangan Pribadi",
    description:
      "Catat pemasukan dan pengeluaran dengan mudah. Pantau saldo dan kelola anggaran harianmu bersama Finance Zenio.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
