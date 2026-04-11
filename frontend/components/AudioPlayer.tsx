"use client";

import { PauseCircle, PlayCircle, Volume2 } from "lucide-react";

type AudioPlayerProps = {
  src: string;
  title: string;
};

export function AudioPlayer({ src, title }: AudioPlayerProps) {
  return (
    <div className="my-8 rounded-2xl bg-zinc-100/80 px-5 py-4">
      <div className="mb-3 flex items-center gap-3 text-zinc-600">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
          <PlayCircle className="h-4 w-4" />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
          <PauseCircle className="h-4 w-4" />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Volume2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900">{title}</p>
          <p className="text-xs text-zinc-500">Audio preview</p>
        </div>
      </div>
      <audio controls preload="metadata" className="w-full" src={src}>
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
