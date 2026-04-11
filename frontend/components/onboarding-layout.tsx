import { ReactNode } from "react";

export function OnboardingLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-canvas">{children}</main>;
}
