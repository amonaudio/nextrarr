/**
 * MediaPlayer — persistent bottom bar with audio player for theme.mp3.
 *
 * [0.7.10] FIX: replaced manual addEventListener with JSX event props
 * (onPlay, onPause, onTimeUpdate, etc.). React now manages listener
 * attachment/detachment automatically — when the <audio> element remounts
 * (key change on playingUrl), the new element gets listeners attached
 * on the next render. Previously, the useEffect had [isSeeking] as the
 * only dep, so when playingUrl changed and the element remounted, the
 * listeners were attached to the OLD (now-unmounted) element → play/pause
 * button didn't update, duration stayed 0, seek bar was disabled.
 *
 * [0.7.10] FIX: use a ref for isSeeking instead of state, so the
 * onTimeUpdate handler always reads the latest value without needing
 * the handler to be recreated on every isSeeking change.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useExtrarrStore } from '@/store/extrarr-store';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Volume1, Music, Loader2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SKIP_SECONDS = 10;

export function MediaPlayer() {
  const { playingTitle, playingUrl, setPlaying } = useExtrarrStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // [0.7.10] Use a ref for isSeeking so onTimeUpdate reads the latest
  // value without needing the handler to be recreated on every change.
  const isSeekingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when the URL changes (new track selected)
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setIsPlaying(false);
    if (playingUrl && audioRef.current) {
      const audio = audioRef.current;
      audio.volume = volume;
      audio.play().catch(() => {
        // Autoplay can fail if the browser blocks it.
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingUrl]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => { /* ignore */ });
    } else {
      audio.pause();
    }
  }, []);

  const skipBy = useCallback((deltaSec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + deltaSec));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !value[0]) return;
    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !value[0]) return;
    const v = value[0];
    audio.volume = v;
    audio.muted = v === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
  }, []);

  const handleClose = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying('Nessun media selezionato', null);
  }, [setPlaying]);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const hasTrack = !!playingUrl;

  return (
    <TooltipProvider delayDuration={300}>
    <div
      className="fixed bottom-0 left-0 w-full z-40 border-t border-border/50 backdrop-blur-xl bg-gradient-to-r from-card/95 via-card/90 to-card/95 px-3 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 h-20 box-border shadow-2xl shadow-black/30"
    >
      {/* [0.7.10] Hidden native audio element — now using JSX event props
          instead of manual addEventListener. React manages listener
          lifecycle automatically. */}
      <audio
        ref={audioRef}
        key={playingUrl ?? 'none'}
        src={playingUrl ?? undefined}
        preload="metadata"
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => {
          if (!isSeekingRef.current) {
            setCurrentTime(e.currentTarget.currentTime);
          }
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onProgress={(e) => {
          try {
            const audio = e.currentTarget;
            if (audio.buffered.length > 0) {
              setBuffered(audio.buffered.end(audio.buffered.length - 1));
            }
          } catch { /* ignore */ }
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onCanPlay={() => setIsLoading(false)}
        onEnded={() => setIsPlaying(false)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setIsMuted(e.currentTarget.muted);
        }}
      />

      {/* Cover art */}
      <div
        className={cn(
          'shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center transition-colors',
          hasTrack
            ? isPlaying
              ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30'
              : 'bg-muted text-muted-foreground'
            : 'bg-muted/50 text-muted-foreground/50'
        )}
      >
        {hasTrack && isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Music
            className={cn('h-5 w-5 sm:h-6 sm:w-6', hasTrack && isPlaying && 'animate-pulse')}
          />
        )}
      </div>

      {/* Title */}
      <div className="shrink-0 w-1/4 min-w-0 hidden sm:block">
        <div className="text-sm font-semibold text-primary truncate flex items-center gap-2">
          {isPlaying && (
            <span className="inline-flex gap-0.5 items-end h-3" aria-hidden>
              <span className="w-0.5 bg-primary animate-equalize-1 rounded-full" style={{ height: '60%' }} />
              <span className="w-0.5 bg-primary animate-equalize-2 rounded-full" style={{ height: '100%' }} />
              <span className="w-0.5 bg-primary animate-equalize-3 rounded-full" style={{ height: '40%' }} />
            </span>
          )}
          <span className="truncate">{hasTrack ? playingTitle : 'Nessun media in riproduzione'}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {hasTrack ? (isPlaying ? 'In riproduzione' : 'In pausa') : 'Seleziona un tema dalla griglia'}
        </div>
      </div>

      {/* Center controls */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => skipBy(-SKIP_SECONDS)}
                disabled={!hasTrack}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Indietro di {SKIP_SECONDS}s</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                onClick={togglePlayPause}
                disabled={!hasTrack}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPlaying ? 'Pausa' : 'Riproduci'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => skipBy(SKIP_SECONDS)}
                disabled={!hasTrack}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Avanti di {SKIP_SECONDS}s</TooltipContent>
          </Tooltip>

          <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums w-10 text-right">
            {formatTime(currentTime)}
          </span>

          <div className="flex-1 relative group/seek min-w-0">
            {duration > 0 && buffered > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-muted-foreground/30 pointer-events-none"
                style={{ width: `${(buffered / duration) * 100}%`, left: 0 }}
                aria-hidden
              />
            )}
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 0}
              step={0.1}
              onValueChange={handleSeek}
              onPointerDown={() => { isSeekingRef.current = true; }}
              onValueCommit={() => { isSeekingRef.current = false; }}
              disabled={!hasTrack || duration === 0}
              className="flex-1"
              aria-label="Posizione riproduzione"
            />
          </div>

          <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Volume + close */}
      <div className="shrink-0 flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={toggleMute}
              disabled={!hasTrack}
            >
              <VolumeIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isMuted ? 'Riattiva audio' : 'Disattiva audio'}</TooltipContent>
        </Tooltip>
        <Slider
          value={[isMuted ? 0 : volume]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={handleVolumeChange}
          disabled={!hasTrack}
          className="w-20 hidden sm:flex"
          aria-label="Volume"
        />
        {hasTrack && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chiudi player</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
