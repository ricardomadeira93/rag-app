import { ChatShell } from "@/components/chat/ChatShell";

export default async function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const parameters = await params;
  return <ChatShell conversationId={parameters.id} />;
}
