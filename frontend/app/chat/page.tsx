import { Suspense } from "react";

import { ChatShell } from "@/components/chat/ChatShell";

export default function ChatPage() {
  return (
    <Suspense>
      <ChatShell />
    </Suspense>
  );
}

