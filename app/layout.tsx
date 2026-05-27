import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Markdown Reviewer",
  description: "View, navigate, diff, and peer-review Markdown files.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
