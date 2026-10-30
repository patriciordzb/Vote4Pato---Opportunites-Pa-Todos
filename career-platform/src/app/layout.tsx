import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "SHPE 2026 | Career Intelligence Command Center", template: "%s · SHPE 2026 Command Center" },
  description: "Personal career-intelligence platform and networking CRM for the 2026 SHPE National Convention.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070c1a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en" className={theme === "dark" ? "dark" : ""}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
