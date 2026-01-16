import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/components/layout";
import { Toaster } from "@/components/ui/sonner";
import { AgentProvider } from "@/contexts/AgentContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MACt Chatbot Admin",
  description: "AI-powered chatbot admin panel for MACt GFRC Products",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AgentProvider>
          <MainLayout>{children}</MainLayout>
          <Toaster position="top-right" />
        </AgentProvider>
      </body>
    </html>
  );
}
