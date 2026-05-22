import "./globals.css";

export const metadata = {
  title: "BotHive — WhatsApp Bot Platform",
  description: "Multi-tenant WhatsApp automation platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-surface-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
