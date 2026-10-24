/**
 * nEXTrarr — Next.js port of the Flask app.
 * Main page: orchestrates all components and handles cross-component actions.
 *
 * In demo mode (no API keys configured OR EXTRARR_DEMO_MODE=1), the app uses
 * mock data so you can see the UI in the sandbox preview.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/extrarr/header';
import { MediaGrid } from '@/components/extrarr/media-grid';
import { MediaPlayer } from '@/components/extrarr/media-player';
import { SettingsModal } from '@/components/extrarr/settings-modal';
import { CustomFilterModal } from '@/components/extrarr/custom-filter-modal';
import { EditorModal } from '@/components/extrarr/editor-modal';
import { ArtworkModal } from '@/components/extrarr/artwork-modal';
import { VideoModal, type VideoModalAction } from '@/components/extrarr/video-modal';
import { useExtrarrStore } from '@/store/extrarr-store';
import { toast } from 'sonner';
import type { CustomFilter, MediaItem } from '@/lib/types';

export default function Home() {
  const {
    mediaType, mediaList, loadingMedia, mediaError,
    setMediaList, setLoadingMedia, setMediaError,
    currentMediaId, setCurrentMediaId,
    mainFilter, setMainFilter,
    activeCustomFilter, setActiveCustomFilter,
    setPlaying,
    patchMedia,
  } = useExtrarrStore();

  const [rootFolders, setRootFolders] = useState<string[]>([]);

  // Modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [artworkOpen, setArtworkOpen] = useState(false);

  // Video modal
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoAction, setVideoAction] = useState<VideoModalAction | null>(null);

  // Search modal (global YouTube search results)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; video_id: string }[]>([]);
  const [searchCustomUrl, setSearchCustomUrl] = useState('');

  const currentMedia = mediaList.find((m) => m.id === currentMediaId) ?? null;

  // [0.7.2] Removed the global ESC handler that was added in 0.7.1:
  // now that VideoModal, image zoom, and global search are all Radix
  // Dialogs, ESC is handled natively by Radix (it closes the topmost
  // modal first, exactly what we want). The custom handler was fighting
  // with Radix and was no longer needed.

  const loadMedia = useCallback(async () => {
    setLoadingMedia(true);
    setMediaError(null);
    try {
      const res = await fetch(`/api/media/${mediaType}`);
      const data = await res.json();
      if (data.error) {
        setMediaError(data.error);
        setMediaList([]);
      } else {
        setMediaList(data as MediaItem[]);
      }
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : 'Errore di rete');
    } finally {
      setLoadingMedia(false);
    }
  }, [mediaType, setMediaList, setLoadingMedia, setMediaError]);

  const loadRootFolders = useCallback(async () => {
    try {
      const res = await fetch(`/api/root-folders/${mediaType}`);
      const data = await res.json();
      if (Array.isArray(data)) setRootFolders(data);
    } catch {
      // ignore
    }
  }, [mediaType]);

  useEffect(() => { loadRootFolders(); }, [loadRootFolders]);
  useEffect(() => { loadMedia(); }, [loadMedia]);

  // === Action handlers (passed to children) ===

  async function onQuickDownload(id: number, btn: HTMLButtonElement | null) {
    if (btn) { (btn as unknown as HTMLElement).style.opacity = '0.5'; }
    try {
      const res = await fetch(`/api/download-media/${mediaType}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.status === 'success') {
        patchMedia(id, { has_theme: true });
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    } finally {
      if (btn) { (btn as unknown as HTMLElement).style.opacity = '1'; }
    }
  }

  async function onDownloadArtwork(id: number, btn: HTMLButtonElement | null) {
    if (btn) { (btn as unknown as HTMLElement).style.opacity = '0.5'; }
    try {
      const res = await fetch(`/api/download-artwork/${mediaType}/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        patchMedia(id, { has_artwork: true });
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    } finally {
      if (btn) { (btn as unknown as HTMLElement).style.opacity = '1'; }
    }
  }

  function onPlayTheme(id: number, title: string) {
    const url = `/api/audio-media/${mediaType}/${id}?t=${Date.now()}`;
    setPlaying(`🎵 ${title}`, url);
  }

  async function onPlayTrailer(id: number, title: string) {
    try {
      const res = await fetch(`/api/get-trailer/${mediaType}/${id}`);
      const data = await res.json();
      if (data.status === 'success' && data.video_id) {
        setVideoId(data.video_id);
        setVideoUrl(`https://www.youtube.com/watch?v=${data.video_id}`);
        setVideoAction(null);
        setVideoOpen(true);
      } else {
        toast.error(data.message ?? 'Nessun trailer trovato');
      }
    } catch {
      toast.error('Errore di rete');
    }
  }

  function onOpenEditor(id: number) {
    setCurrentMediaId(id);
    setEditorOpen(true);
  }

  function onViewArtwork(id: number, _title: string) {
    setCurrentMediaId(id);
    setArtworkOpen(true);
  }

  function onShowWarning(msg: string) {
    toast.warning(msg);
  }

  // [0.7.7] Refresh handler — clears the server-side mediaCache via a
  // POST /api/refresh call, then reloads the media list and root folders.
  // Wired to the previously-dead Refresh button in the Header. Used after
  // changing path mappings or downloading artwork outside nEXTrarr.
  async function onRefresh() {
    try {
      await fetch('/api/refresh', { method: 'POST' });
    } catch {
      // ignore — proceed with client-side reload anyway
    }
    await Promise.all([loadMedia(), loadRootFolders()]);
    toast.success('Libreria aggiornata');
  }

  // Global YouTube search
  async function onGlobalSearch(q: string) {
    if (!q.trim()) return;
    setSearchOpen(true);
    setSearchTitle(`Risultati per: ${q}`);
    setSearchResults([]);
    setSearchCustomUrl('');
    try {
      const res = await fetch('/api/search-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchResults(data);
      } else if (data.status === 'error') {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    }
  }

  // Preview a search result in the video modal
  function previewSearchResult(videoId: string, url: string) {
    setVideoId(videoId);
    setVideoUrl(url);
    setVideoAction({ kind: 'global', mediaChoices: mediaList.map((m) => ({ id: m.id, title: m.title, year: m.year })), onTheme: async (id, u) => { await assignAndDownload(id, u); }, onTrailer: async (id, u) => { await assignAndSetTrailer(id, u); } });
    setVideoOpen(true);
  }

  async function assignAndDownload(id: number, url: string) {
    setVideoOpen(false);
    try {
      const res = await fetch(`/api/download-media/${mediaType}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        patchMedia(id, { has_theme: true });
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    }
  }

  async function assignAndSetTrailer(id: number, url: string) {
    setVideoOpen(false);
    try {
      const res = await fetch(`/api/set-trailer/${mediaType}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        patchMedia(id, { has_trailer: true });
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    }
  }

  async function downloadCustomUrl() {
    if (!currentMediaId || !searchCustomUrl.trim()) return;
    await assignAndDownload(currentMediaId, searchCustomUrl.trim());
    setSearchOpen(false);
  }

  // Custom filter apply
  function onApplyCustomFilter(f: CustomFilter) {
    setActiveCustomFilter(f);
    setMainFilter('custom_active');
  }

  function onOpenCustomFilters() {
    setCustomFilterOpen(true);
  }

  // NOTE: Directory browser is now handled INSIDE SettingsModal (v0.5 fix).
  // Previously, onBrowserSelect here fetched stale settings from the API
  // (which didn't have unsaved new rows) → overwrote the user's changes.
  // Now the browser updates the Settings modal's local React state directly.

  // Editor preview (theme/trailer YouTube search results)
  function onEditorPreview(videoId: string, url: string, kind: 'editor_theme' | 'editor_trailer') {
    setVideoId(videoId);
    setVideoUrl(url);
    if (kind === 'editor_theme') {
      setVideoAction({ kind: 'editor_theme', onUse: async (u: string) => {
        // Use getState() to get the latest currentMediaId (avoids stale closure)
        const store = useExtrarrStore.getState();
        const id = store.currentMediaId;
        const mt = store.mediaType;
        if (!id) { toast.error('Nessun media selezionato'); setVideoOpen(false); return; }
        try {
          const res = await fetch(`/api/download-media/${mt}/${id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: u }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            store.patchMedia(id, { has_theme: true });
            toast.success(data.message);
            setEditorOpen(false);
          } else { toast.error(data.message); }
        } catch { toast.error('Errore di rete'); }
        setVideoOpen(false);
      } });
    } else {
      setVideoAction({ kind: 'editor_trailer', onUse: async (u: string) => {
        const store = useExtrarrStore.getState();
        const id = store.currentMediaId;
        const mt = store.mediaType;
        if (!id) { toast.error('Nessun media selezionato'); setVideoOpen(false); return; }
        try {
          const res = await fetch(`/api/set-trailer/${mt}/${id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: u }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            store.patchMedia(id, { has_trailer: true });
            toast.success(data.message);
            setEditorOpen(false);
          } else { toast.error(data.message); }
        } catch { toast.error('Errore di rete'); }
        setVideoOpen(false);
      } });
    }
    setVideoOpen(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCustomFilters={onOpenCustomFilters}
        onGlobalSearch={onGlobalSearch}
        onRefresh={onRefresh}
        rootFolders={rootFolders}
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-10 pb-24 pt-4">
        <MediaGrid
          onQuickDownload={onQuickDownload}
          onDownloadArtwork={onDownloadArtwork}
          onPlayTheme={onPlayTheme}
          onViewArtwork={onViewArtwork}
          onPlayTrailer={onPlayTrailer}
          onOpenEditor={onOpenEditor}
          onShowWarning={onShowWarning}
          activeCustomFilter={activeCustomFilter}
        />
      </main>

      <MediaPlayer />

      {/* Modals */}
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={() => { loadMedia(); loadRootFolders(); }}
      />
      <CustomFilterModal
        open={customFilterOpen}
        onOpenChange={setCustomFilterOpen}
        onApply={onApplyCustomFilter}
        onChanged={() => {}}
      />
      <EditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        media={currentMedia}
        mediaType={mediaType}
        onPreviewResult={onEditorPreview}
        onChanged={() => { loadMedia(); }}
      />
      <ArtworkModal
        open={artworkOpen}
        onOpenChange={setArtworkOpen}
        media={currentMedia}
        mediaType={mediaType}
        onChanged={() => { loadMedia(); }}
      />
      <VideoModal
        open={videoOpen}
        videoId={videoId}
        videoUrl={videoUrl}
        action={videoAction}
        onClose={() => setVideoOpen(false)}
      />

      {/* [0.7.2] Global YouTube search modal — converted from a custom <div>
          overlay to a Radix Dialog. The previous custom overlay got `inert`
          from any open parent Radix Dialog (Settings/Editor/Artwork) → its
          buttons were unclickable. Now Radix handles nesting correctly. */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary text-lg font-bold">{searchTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              Risultati della ricerca globale su YouTube. Clicca su un risultato per l'anteprima, oppure incolla un link YouTube diretto.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <Input
              type="text"
              placeholder="Incolla link YouTube qui"
              value={searchCustomUrl}
              onChange={(e) => setSearchCustomUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={downloadCustomUrl} disabled={!searchCustomUrl.trim() || !currentMediaId}>
              Usa Link
            </Button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun risultato.</p>
          ) : (
            <div className="space-y-2">
              {searchResults.map((r) => (
                <button
                  key={r.video_id}
                  className="w-full text-left p-2 bg-card border border-border rounded hover:border-primary"
                  onClick={() => previewSearchResult(r.video_id, r.url)}
                >
                  <div className="font-semibold text-sm">{r.title}</div>
                  <div className="text-xs text-primary mt-1">▶️ Clicca per vedere l'anteprima e scegliere il film</div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
