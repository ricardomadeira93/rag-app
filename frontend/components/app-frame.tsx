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

  // Render the actual page immediately — no blocking spinner.
  // The floating ConnectionStatus card provides feedback while settings load.
  const content = (
    <>
      {!resolved && <ConnectionStatus resolved={resolved} />}
      {children}
    </>
  );

  if (pathname === "/onboarding" || pathname === "/") {
    return <OnboardingLayout>{content}</OnboardingLayout>;
  }

  return <Shell>{content}</Shell>;
}
