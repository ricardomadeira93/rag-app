"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { OnboardingLayout } from "@/components/onboarding-layout";
import { Shell } from "@/components/shell";
import { fetchSettings } from "@/lib/api";
import { applyThemePreference, applyUiTheme, readStoredThemePreference } from "@/lib/ui-theme";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [resolved, setResolved] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    let active = true;
    const storedTheme = readStoredThemePreference();

    applyThemePreference(storedTheme);

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleThemeChange = () => {
      if (!readStoredThemePreference()) {
        applyThemePreference(null);
      }
    };
    mediaQuery?.addEventListener?.("change", handleThemeChange);

    setRefreshing(true);
    fetchSettings()
      .then((settings) => {
        if (active) {
          applyUiTheme(settings);
          setOnboarded(Boolean(settings.onboarding_complete));
          setResolved(true);
          setRefreshing(false);
        }
      })
      .catch(() => {
        if (active) {
          setOnboarded(false);
          setResolved(true);
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
      mediaQuery?.removeEventListener?.("change", handleThemeChange);
    };
  }, [pathname]);

  useEffect(() => {
    if (!resolved || refreshing) {
      return;
    }

    if (pathname === "/") {
      router.replace(onboarded ? "/dashboard" : "/onboarding");
      return;
    }

    if (pathname === "/onboarding" && onboarded) {
      router.replace("/dashboard");
      return;
    }

    if (pathname !== "/onboarding" && !onboarded) {
      router.replace("/onboarding");
    }
  }, [onboarded, pathname, refreshing, resolved, router]);

  if (!resolved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas">
        <div className="flex items-center gap-3 text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="text-sm font-medium">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (pathname === "/onboarding" || pathname === "/") {
    return <OnboardingLayout>{children}</OnboardingLayout>;
  }

  return <Shell>{children}</Shell>;
}
