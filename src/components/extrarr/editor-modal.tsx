/**
 * EditorModal — full media editor with three tabs:
 *   1. 🎵 Tema — search/download theme song from YouTube
 *   2. 🎬 Trailer — search/save trailer URL into the NFO
 *   3. 📝 NFO Editor — full structured form + raw XML editor for the .nfo file
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, Save, Youtube, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { MediaItem, YouTubeSearchResult } from '@/lib/types';
import { NfoEditorTab } from './nfo-editor-tab';

interface EditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  mediaType: 'radarr' | 'sonarr';
  onPreviewResult: (videoId: string, url: string, kind: 'editor_theme' | 'editor_trailer') => void;
  onChanged: () => void;
}

export function EditorModal({ open, onOpenChange, media, mediaType, onPreviewResult, onChanged }: EditorModalProps) {
  const [activeTab, setActiveTab] = useState<'theme' | 'trailer' | 'nfo'>('theme');
  const [themeUrl, setThemeUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [searching, setSearching] = useState<null | 'theme' | 'trailer'>(null);
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [customThemeSearch, setCustomThemeSearch] = useState('');
  const [customTrailerSearch, setCustomTrailerSearch] = useState('');

  useEffect(() => {
    if (open) {
      setActiveTab('theme');
      setThemeUrl('');
      setTrailerUrl('');
      setResults([]);
      setSearching(null);
    }
  }, [open, media?.id]);

  if (!media) return null;
  const themeStatus = media.has_theme ? '✅ Presente' : '❌ Mancante';
  const trailerStatus = media.has_trailer ? '✅ Presente' : '❌ Mancante';

  async function doSearch(type: 'theme' | 'trailer', customQuery?: string) {
    setSearching(type);
    setResults([]);
    try {
      const url = customQuery && customQuery.trim()
        ? `/api/search-media/${mediaType}/${media!.id}/${type}?query=${encodeURIComponent(customQuery.trim())}`
        : `/api/search-media/${mediaType}/${media!.id}/${type}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) setResults(data);
      else if (data.status === 'error') toast.error(data.message);
    } catch {
      toast.error('Errore di rete');
    } finally {
      setSearching(null);
    }
  }

  async function downloadTheme(url?: string) {
    if (!url) { toast.error('URL mancante'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/download-media/${mediaType}/${media!.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
        onChanged();
        onOpenChange(false);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    } finally {
      setBusy(false);
    }
  }

  async function saveTrailer(url?: string) {
    if (!url) { toast.error('URL mancante'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/set-trailer/${mediaType}/${media!.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
        onChanged();
        onOpenChange(false);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        // [0.7.2] Restored unconditional preventDefault. Now that VideoModal
        // is a Radix Dialog itself, Radix handles nested click-outside correctly:
        // clicking outside the VideoModal closes only the VideoModal (Radix
        // intercepts the event at the topmost modal). When the user clicks
        // outside the Editor (with no VideoModal open), we don't want to close
        // it — they're editing NFO fields, an accidental click shouldn't lose
        // their work. Use the X button to close.
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Editor: {media.title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'theme' | 'trailer' | 'nfo')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="theme">🎵 Tema ({themeStatus})</TabsTrigger>
            <TabsTrigger value="trailer">🎬 Trailer ({trailerStatus})</TabsTrigger>
            <TabsTrigger value="nfo">📝 NFO Editor</TabsTrigger>
          </TabsList>

          {/* === Tab 1: Tema === */}
          <TabsContent value="theme" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Cerca su YouTube il tema musicale di &quot;{media.title}&quot; o incolla direttamente un link.
            </p>
            <Button className="w-full" variant="secondary" onClick={() => doSearch('theme')} disabled={searching === 'theme'}>
              {searching === 'theme' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Cerca Tema su YouTube</span>
            </Button>
            <div className="flex gap-2">
              <Input
                placeholder="Ricerca personalizzata (es. Hans Zimmer Interstellar OST)"
                value={customThemeSearch}
                onChange={(e) => setCustomThemeSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doSearch('theme', customThemeSearch); }}
              />
              <Button onClick={() => doSearch('theme', customThemeSearch)} disabled={searching === 'theme'} title="Cerca con testo personalizzato">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Incolla link YouTube tema" value={themeUrl} onChange={(e) => setThemeUrl(e.target.value)} />
              <Button onClick={() => downloadTheme(themeUrl)} disabled={busy}><Download className="h-4 w-4" /></Button>
            </div>
            {searching === 'theme' && (
              <p className="text-xs text-muted-foreground">Ricerca in corso...</p>
            )}
            {results.length > 0 && searching !== 'theme' && (
              <div>
                <h4 className="text-xs font-semibold mb-1">Risultati:</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results.map((r) => (
                    <button
                      key={r.video_id}
                      className="w-full text-left p-2 bg-card border border-border rounded hover:border-primary text-xs"
                      onClick={() => onPreviewResult(r.video_id, r.url, 'editor_theme')}
                    >
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-primary flex items-center gap-1 mt-1">
                        <Youtube className="h-3 w-3" /> Clicca per anteprima
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* === Tab 2: Trailer === */}
          <TabsContent value="trailer" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Cerca su YouTube il trailer di &quot;{media.title}&quot; o incolla un link.
              Il trailer viene salvato nel file NFO nel formato Kodi/Jellyfin
              <code className="bg-muted px-1 mx-1 rounded">plugin://plugin.video.youtube/play/?video_id=XXX</code>.
            </p>
            <Button className="w-full" variant="secondary" onClick={() => doSearch('trailer')} disabled={searching === 'trailer'}>
              {searching === 'trailer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Cerca Trailer su YouTube</span>
            </Button>
            <div className="flex gap-2">
              <Input
                placeholder="Ricerca personalizzata (es. Interstellar trailer ufficiale italiano)"
                value={customTrailerSearch}
                onChange={(e) => setCustomTrailerSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doSearch('trailer', customTrailerSearch); }}
              />
              <Button onClick={() => doSearch('trailer', customTrailerSearch)} disabled={searching === 'trailer'} title="Cerca con testo personalizzato">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Incolla link YouTube trailer" value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)} />
              <Button onClick={() => saveTrailer(trailerUrl)} disabled={busy}><Save className="h-4 w-4" /></Button>
            </div>
            {searching === 'trailer' && (
              <p className="text-xs text-muted-foreground">Ricerca in corso...</p>
            )}
            {results.length > 0 && searching !== 'trailer' && (
              <div>
                <h4 className="text-xs font-semibold mb-1">Risultati:</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results.map((r) => (
                    <button
                      key={r.video_id}
                      className="w-full text-left p-2 bg-card border border-border rounded hover:border-primary text-xs"
                      onClick={() => onPreviewResult(r.video_id, r.url, 'editor_trailer')}
                    >
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-primary flex items-center gap-1 mt-1">
                        <Youtube className="h-3 w-3" /> Clicca per anteprima
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* === Tab 3: NFO Editor === */}
          <TabsContent value="nfo" className="mt-3">
            <NfoEditorTab
              mediaType={mediaType}
              mediaId={media.id}
              onChanged={onChanged}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
