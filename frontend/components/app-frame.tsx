"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ConnectionStatus } from "@/components/connection-status";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { Shell } from "@/components/shell";
import { fetchSettings } from "@/lib/api";
import { applyThemePreference, applyUiTheme, readStoredThemePreference } from "@/lib/ui-theme";

// Pages that render standalone — no Shell, no OnboardingLayout.
const STANDALONE_PATHS = ["/", "/landing"];
const ONBOARDING_COMPLETE_EVENT = "stark:onboarding-complete";

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
    const handleOnboardingComplete = () => {
      if (active) {
        setOnboarded(true);
        setResolved(true);
        setRefreshing(false);
      }
    };
    mediaQuery?.addEventListener?.("change", handleThemeChange);
    window.addEventListener(ONBOARDING_COMPLETE_EVENT, handleOnboardingComplete);

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
      window.removeEventListener(ONBOARDING_COMPLETE_EVENT, handleOnboardingComplete);
    };
  }, [pathname]);

  useEffect(() => {
    if (!resolved || refreshing) {
      return;
    }

    // Landing page is always accessible — never redirect away from it.
    if (STANDALONE_PATHS.includes(pathname)) {
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

  // Standalone pages render without any app chrome.
  if (STANDALONE_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  if (pathname === "/onboarding") {
    return <OnboardingLayout>{children}</OnboardingLayout>;
  }

  return <Shell>{children}</Shell>;
}

