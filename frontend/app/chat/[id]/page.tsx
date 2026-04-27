import { redirect } from "next/navigation";

export default async function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const parameters = await params;
  redirect(`/dashboard/${parameters.id}`);
}
