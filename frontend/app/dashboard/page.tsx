import { Suspense } from "react";

import { ChatShell } from "@/components/chat/ChatShell";

export default function DashboardPage() {
  return (
    <Suspense>
      <ChatShell />
    </Suspense>
  );
}
