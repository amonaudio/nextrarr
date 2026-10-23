/**
 * MediaPlayer — persistent bottom bar with audio player for theme.mp3.
 */

'use client';

import { useExtrarrStore } from '@/store/extrarr-store';

export function MediaPlayer() {
  const { playingTitle, playingUrl, mediaType } = useExtrarrStore();
  return (
    <div className="fixed bottom-0 left-0 w-full bg-card border-t border-border px-4 py-2 flex items-center justify-between z-[90] h-20 box-border">
      <span className="text-primary font-bold w-1/4 truncate text-sm">{playingTitle}</span>
      <div className="flex-1 flex justify-center items-center h-full">
        {playingUrl ? (
          <audio key={playingUrl} controls autoPlay className="w-full max-w-[600px]">
            <source src={playingUrl} type="audio/mpeg" />
          </audio>
        ) : (
          <span className="text-xs text-muted-foreground">
            (Sandbox demo: l'audio è silente in modalità demo)
            {mediaType ? '' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
