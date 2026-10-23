/**
 * nEXTrarr — Next.js port of the Flask app.
 * Main page: orchestrates all components and handles cross-component actions.
 *
 * In demo mode (no API keys configured OR EXTRARR_DEMO_MODE=1), the app uses
 * mock data so you can see the UI in the sandbox preview.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/extrarr/header';
import { MediaGrid } from '@/components/extrarr/media-grid';
import { MediaPlayer } from '@/components/extrarr/media-player';
import { SettingsModal } from '@/components/extrarr/settings-modal';
import { DirectoryBrowserModal } from '@/components/extrarr/directory-browser-modal';
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
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserTargetIndex, setBrowserTargetIndex] = useState<number | null>(null);
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

  // Path mapping browser
  function onBrowse(index: number) {
    setBrowserTargetIndex(index);
    setBrowserOpen(true);
  }

  async function onBrowserSelect(path: string) {
    if (browserTargetIndex === null) return;
    // Read current settings, update the path at index, save
    try {
      const r = await fetch('/api/settings');
      const settings = await r.json();
      if (Array.isArray(settings.pathMap) && settings.pathMap[browserTargetIndex]) {
        settings.pathMap[browserTargetIndex].local = path;
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        });
        toast.success('Percorso aggiornato');
      }
    } catch {
      toast.error('Errore salvataggio');
    }
  }

  // Editor preview (theme/trailer YouTube search results)
  function onEditorPreview(videoId: string, url: string, kind: 'editor_theme' | 'editor_trailer') {
    setVideoId(videoId);
    setVideoUrl(url);
    if (kind === 'editor_theme') {
      setVideoAction({ kind: 'editor_theme', onUse: async (u) => {
        // Reuse editor's download logic by POSTing directly
        if (!currentMediaId) return;
        try {
          const res = await fetch(`/api/download-media/${mediaType}/${currentMediaId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: u }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            patchMedia(currentMediaId, { has_theme: true });
            toast.success(data.message);
            setEditorOpen(false);
          } else toast.error(data.message);
        } catch { toast.error('Errore di rete'); }
        setVideoOpen(false);
      } });
    } else {
      setVideoAction({ kind: 'editor_trailer', onUse: async (u) => {
        if (!currentMediaId) return;
        try {
          const res = await fetch(`/api/set-trailer/${mediaType}/${currentMediaId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: u }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            patchMedia(currentMediaId, { has_trailer: true });
            toast.success(data.message);
            setEditorOpen(false);
          } else toast.error(data.message);
        } catch { toast.error('Errore di rete'); }
        setVideoOpen(false);
      } });
    }
    setVideoOpen(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground px-4 sm:px-6 lg:px-10 pb-24 pt-4">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCustomFilters={onOpenCustomFilters}
        onGlobalSearch={onGlobalSearch}
        rootFolders={rootFolders}
      />

      <main className="flex-1">
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
        onBrowse={onBrowse}
      />
      <DirectoryBrowserModal
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={onBrowserSelect}
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

      {/* Global YouTube search modal — simple inline */}
      {searchOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-background border border-primary rounded-lg max-w-2xl w-full p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-3">
              <h2 className="text-primary text-lg font-bold">{searchTitle}</h2>
              <button onClick={() => setSearchOpen(false)} className="text-2xl">×</button>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Incolla link YouTube qui"
                value={searchCustomUrl}
                onChange={(e) => setSearchCustomUrl(e.target.value)}
                className="flex-1 px-2 py-1 bg-card border border-border rounded text-sm"
              />
              <button
                onClick={downloadCustomUrl}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >Usa Link</button>
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
          </div>
        </div>
      )}
    </div>
  );
}
