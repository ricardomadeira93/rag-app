import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stark — Your Private AI Knowledge Base",
  description:
    "Upload your documents, audio, and images. Chat with your private knowledge base using AI — with citations, semantic search, and full local-first privacy.",
};

// Standalone layout that intentionally bypasses the app shell (sidebar, topbar, onboarding gate).
export default function LandingLayout({ children }: { children: ReactNode }) {
  return children;
}
