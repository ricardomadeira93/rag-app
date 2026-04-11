import { DocumentPage } from "@/components/DocumentPage";

export default async function DocumentReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentPage documentId={id} />;
}
