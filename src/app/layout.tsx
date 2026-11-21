import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  src: "./fonts/manrope.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});
const sinhala = localFont({
  src: "./fonts/noto-sans-sinhala.ttf",
  variable: "--font-sinhala",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const initializeTheme = `try{const theme=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',theme==='dark'||(!theme&&window.matchMedia('(prefers-color-scheme: dark)').matches));}catch{document.documentElement.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches);}`;
export const metadata: Metadata = {
  metadataBase: new URL("https://workcopilotai.vercel.app"),
  title: { default: "WorkCopilot", template: "%s · WorkCopilot" },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "569x410" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  description:
    "Beyond Answers. Into Action. Your private, read-only WhatsApp AI assistant.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${sinhala.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
