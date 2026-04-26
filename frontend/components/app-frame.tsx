"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ConnectionStatus } from "@/components/connection-status";
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

  // While settings are loading, render the page content as-is (no layout wrapper)
  // so the user sees the UI immediately. The card signals the connection state.
  if (!resolved) {
    return (
      <>
        <ConnectionStatus resolved={false} />
        {children}
      </>
    );
  }

  if (pathname === "/onboarding" || pathname === "/") {
    return <OnboardingLayout>{children}</OnboardingLayout>;
  }

  return <Shell>{children}</Shell>;
}

