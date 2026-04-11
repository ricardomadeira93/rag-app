import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";

import "@/app/globals.css";
import { AppFrame } from "@/components/app-frame";
import { ToastProvider } from "@/components/toast-provider";
import { THEME_STORAGE_KEY } from "@/lib/ui-theme";

export const metadata: Metadata = {
  title: "Local RAG",
  description: "Local knowledge system",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script id="theme-init" strategy="beforeInteractive">{`
          (() => {
            try {
              const stored = window.localStorage.getItem("${THEME_STORAGE_KEY}");
              const resolved = stored === "dark" || stored === "light"
                ? stored
                : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
              document.documentElement.classList.toggle("dark", resolved === "dark");
            } catch {}
          })();
        `}</Script>
        <ToastProvider>
          <AppFrame>{children}</AppFrame>
        </ToastProvider>
      </body>
    </html>
  );
}
