"use client";

type FileUploadProps = {
  files: File[];
  onChange: (files: File[]) => void;
  onUpload: () => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  message?: string | null;
};

export function FileUpload({ files, onChange, onUpload, disabled, loading, message }: FileUploadProps) {
  return (
    <div className="space-y-4">
      <div className="border border-line bg-white px-4 py-4">
        <p className="text-sm font-medium">Upload first document</p>
        <p className="mt-1 text-sm text-muted">Accepted: PDF, Markdown, images, and audio.</p>
        <input
          type="file"
          multiple
          accept=".pdf,.md,.markdown,.png,.jpg,.jpeg,.webp,.tiff,.bmp,.mp3,.wav,.m4a,.flac,.ogg"
          onChange={(event) => onChange(Array.from(event.target.files ?? []))}
          className="mt-4 w-full border border-dashed border-line px-3 py-3 text-sm"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{files.length > 0 ? `${files.length} file(s) selected` : "No files selected"}</p>
        <button
          type="button"
          onClick={() => void onUpload()}
          disabled={disabled || loading || files.length === 0}
          className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
