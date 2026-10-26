/**
 * [0.8.3] Read-only in-app browser for a media folder.
 *
 * Browsers cannot open Finder/Explorer on the server, so this modal shows
 * the folder contents returned by /api/local-folder. It deliberately has
 * no upload/delete/navigation actions — artwork management stays in the
 * existing ArtworkModal.
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, File, Folder, FolderOpen, HardDrive, Link2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { MediaItem } from '@/lib/types';

interface FolderEntry {
  name: string;
  type: 'directory' | 'file' | 'symlink';
  size: number | null;
}

interface FolderListing {
  path: string;
  entries: FolderEntry[];
  truncated: boolean;
}

interface LocalFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  mediaType: 'radarr' | 'sonarr';
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function LocalFolderModal({ open, onOpenChange, media, mediaType }: LocalFolderModalProps) {
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !media) return;
    const controller = new AbortController();

    fetch(`/api/local-folder/${mediaType}/${media.id}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.status === 'error') {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
        return data as FolderListing;
      })
      .then((data) => setListing(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Errore di rete');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, media, mediaType]);

  if (!media) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl h-[80vh] max-h-[80vh] grid-rows-[auto_auto_minmax(0,1fr)] gap-3 p-4 sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <FolderOpen className="h-5 w-5 text-primary shrink-0" />
            <span className="shrink-0">Cartella locale</span>
            <span className="text-sm text-muted-foreground font-normal truncate">
              {media.title}
            </span>
          </DialogTitle>
          <DialogDescription className="font-mono text-xs break-all rounded-md border border-border bg-muted/30 px-2 py-1.5">
            {listing?.path ?? media.local_path}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            Sola lettura · {listing ? `${listing.entries.length} elementi` : 'lettura in corso'}
          </span>
          <span>Nessun file viene modificato</span>
        </div>

        <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card/40">
          {loading ? (
            <div className="flex h-full min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lettura cartella...
            </div>
          ) : error ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : !listing || listing.entries.length === 0 ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Folder className="h-7 w-7 opacity-40" />
              La cartella è vuota.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {listing.entries.map((entry) => {
                const Icon = entry.type === 'directory' ? Folder : entry.type === 'symlink' ? Link2 : File;
                return (
                  <li key={entry.name} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Icon
                      className={
                        entry.type === 'directory'
                          ? 'h-4 w-4 shrink-0 text-primary'
                          : 'h-4 w-4 shrink-0 text-muted-foreground'
                      }
                    />
                    <span className="min-w-0 flex-1 truncate" title={entry.name}>
                      {entry.name}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {entry.type === 'directory' ? 'cartella' : entry.type === 'symlink' ? 'link' : formatBytes(entry.size)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {listing?.truncated && (
            <p className="border-t border-border px-3 py-2 text-center text-[11px] text-muted-foreground">
              Elenco limitato ai primi 500 elementi.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
