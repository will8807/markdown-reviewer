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
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        {/* Apply theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  var p;
  try{p=localStorage.getItem('markdown-reviewer:theme');}catch(e){}
  var dark=(p==='dark')||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(dark)document.documentElement.classList.add('dark');
})();
        `.trim(),
          }}
        />
      </head>
      <body className="h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
