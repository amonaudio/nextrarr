'use client';

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SettingsModal } from '@/components/extrarr/settings-modal';
import { CustomFilterModal } from '@/components/extrarr/custom-filter-modal';
import { EditorModal } from '@/components/extrarr/editor-modal';
import { ArtworkModal } from '@/components/extrarr/artwork-modal';
import { VideoModal, type VideoModalAction } from '@/components/extrarr/video-modal';
import { MediaPlayer } from '@/components/extrarr/media-player';
import { useExtrarrStore } from '@/store/extrarr-store';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import type { CustomFilter, MediaItem } from '@/lib/types';
import { 
  Film, Tv, Grid3X3, Settings, RefreshCw, SlidersHorizontal, CheckCircle,
  Wand2, Image as ImageIcon, Play
} from 'lucide-react';

export function CommandLayout() {
  const {
    mediaType, mediaList,
    setMediaList, setLoadingMedia, setMediaError,
    currentMediaId, setCurrentMediaId,
    mainFilter, setMainFilter,
    activeCustomFilter, setActiveCustomFilter,
    setPlaying,
    patchMedia,
  } = useExtrarrStore();

  const [rootFolders, setRootFolders] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [artworkOpen, setArtworkOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoAction, setVideoAction] = useState<VideoModalAction | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; video_id: string }[]>([]);

  const currentMedia = mediaList.find((m) => m.id === currentMediaId) ?? null;

  const loadMedia = useCallback(async () => {
    setLoadingMedia(true);
    setMediaError(null);
    try {
      const data = await apiFetch<MediaItem[] | { error: string }>(`/api/media/${mediaType}`);
      if (data && typeof data === 'object' && 'error' in data) {
        setMediaError((data as any).error);
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
      const data = await apiFetch<string[]>(`/api/root-folders/${mediaType}`);
      if (Array.isArray(data)) setRootFolders(data);
    } catch {}
  }, [mediaType]);

  useEffect(() => {
    let active = true;
    Promise.resolve(useExtrarrStore.persist.rehydrate())
      .then(() => { if (active) setHydrated(true); })
      .catch(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (hydrated) loadRootFolders(); }, [hydrated, loadRootFolders]);
  useEffect(() => { if (hydrated) loadMedia(); }, [hydrated, loadMedia]);

  const stats = useMemo(() => {
    let tH = 0, tM = 0, aH = 0, aM = 0, trH = 0, trM = 0, valid = 0;
    for (const m of mediaList) {
      if (m.is_mapped && m.folder_exists) {
        valid++;
        if (m.has_theme) tH++; else tM++;
        if (m.has_artwork) aH++; else aM++;
        if (m.has_trailer) trH++; else trM++;
      }
    }
    const pct = valid > 0 ? Math.round(((tH+aH+trH)/(valid*3))*100) : 100;
    return { tH, tM, aH, aM, trH, trM, valid, total: mediaList.length, pct };
  }, [mediaList]);

  const filtered = useMemo(() => {
    let list = mediaList.filter((m) => m.is_mapped && m.folder_exists);
    if (mainFilter === 'missing_theme') list = list.filter(m => !m.has_theme);
    if (mainFilter === 'missing_art') list = list.filter(m => !m.has_artwork);
    if (mainFilter === 'missing_trailer') list = list.filter(m => !m.has_trailer);
    if (mainFilter === 'complete') list = list.filter(m => m.has_theme && m.has_artwork && m.has_trailer);
    return list.slice(0, 48);
  }, [mediaList, mainFilter]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await apiFetch('/api/refresh', { method: 'POST' });
      await loadMedia();
      toast.success('Libreria aggiornata');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore di aggiornamento');
    } finally {
      setRefreshing(false);
    }
  }

  function onOpenEditor(id: number) {
    setCurrentMediaId(id);
    setEditorOpen(true);
  }

  function onViewArtwork(id: number) {
    setCurrentMediaId(id);
    setArtworkOpen(true);
  }

  function onEditorPreview(url: string, videoId: string) {
    setVideoUrl(url); setVideoId(videoId);
    setVideoAction({ kind: 'editor_theme', onUse: async (u: string) => {
      const store = useExtrarrStore.getState();
      const id = store.currentMediaId; const mt = store.mediaType;
      if (!id) { toast.error('Nessun media selezionato'); setVideoOpen(false); return; }
      try {
        const data = await apiFetch<{ status: string; message: string }>(`/api/download-media/${mt}/${id}`, { method: 'POST', body: JSON.stringify({ url: u }) });
        if (data.status === 'success') { store.patchMedia(id, { has_theme: true }); toast.success(data.message); setEditorOpen(false); }
        else toast.error(data.message);
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Errore di rete'); }
      setVideoOpen(false);
    } });
    setVideoOpen(true);
  }

  function onOpenCustomFilters() { setCustomFilterOpen(true); }
  function onApplyCustomFilter(f: CustomFilter | null) { setActiveCustomFilter(f); setMainFilter(f ? 'custom_active' : 'all'); }

  return (
    <div className="app" style={{ position: 'relative', zIndex: 1, display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 252, flex: '0 0 252px', height: '100vh', position: 'sticky', top: 0,
        display: 'flex', flexDirection: 'column', gap: 18, padding: '18px 14px 14px',
        borderRight: '1px solid var(--line)', background: 'color-mix(in srgb, var(--surface) 64%, transparent)',
        backdropFilter: 'blur(22px)', zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center',
              background: 'linear-gradient(145deg, var(--accent), var(--accent-2))', color: 'var(--accent-ink)',
              fontWeight: 900, fontSize: 17, letterSpacing: '-.08em', boxShadow: '0 8px 22px var(--accent-soft), inset 0 0 0 1px rgba(255,255,255,.18)'
            }}>N</div>
            <span style={{ fontSize: 17, fontWeight: 850, letterSpacing: '-.045em' }}>n<b style={{ color: 'var(--accent-strong)' }}>EXT</b>rarr<span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--muted)', letterSpacing: '.08em', marginLeft: 5, padding: '2px 5px', border: '1px solid var(--line)', borderRadius: 5, verticalAlign: '2px' }}>0.8.31</span></span>
          </div>
        </div>
        <div style={{ display: 'flex', padding: 3, gap: 3, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 11 }}>
          <button onClick={() => { useExtrarrStore.getState().setMediaType('radarr'); setTimeout(loadMedia, 50); }} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32, border: 0, borderRadius: 8,
            background: mediaType === 'radarr' ? 'var(--surface-3)' : 'transparent', color: mediaType === 'radarr' ? 'var(--text)' : 'var(--muted)', fontSize: 11.5, fontWeight: 700
          }}><Film size={14} /> Film</button>
          <button onClick={() => { useExtrarrStore.getState().setMediaType('sonarr'); setTimeout(loadMedia, 50); }} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32, border: 0, borderRadius: 8,
            background: mediaType === 'sonarr' ? 'var(--surface-3)' : 'transparent', color: mediaType === 'sonarr' ? 'var(--text)' : 'var(--muted)', fontSize: 11.5, fontWeight: 700
          }}><Tv size={14} /> Serie</button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 10px' }}>Workspace</span>
          <button style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, width: '100%', height: 37, padding: '0 10px', border: '1px solid var(--accent-line)', borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, textAlign: 'left' }}>
            <Grid3X3 size={16} style={{ color: 'var(--accent-strong)' }} /> Libreria<span style={{ marginLeft: 'auto', minWidth: 22, height: 18, padding: '0 6px', borderRadius: 99, background: 'var(--accent)', color: 'var(--accent-ink)', fontFamily: 'var(--mono)', fontSize: 9, display: 'grid', placeItems: 'center' }}>{stats.total}</span>
          </button>
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 11, background: 'var(--surface-2)', fontSize: 10.5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2.5s infinite' }}></span>
            <div style={{ minWidth: 0, lineHeight: 1.3 }}>
              <strong style={{ display: 'block', fontSize: 10.5, color: 'var(--text-2)', fontWeight: 700 }}>{mediaType === 'radarr' ? 'Radarr' : 'Sonarr'}</strong>
              <span style={{ display: 'block', color: 'var(--muted)', fontSize: 9.5 }}>{stats.total} titoli</span>
            </div>
          </div>
          <button onClick={() => setSettingsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 4px', border: 0, background: 'transparent', borderRadius: 9, textAlign: 'left', width: '100%', color: 'var(--text)' }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg, var(--accent), var(--accent-2))', color: 'var(--accent-ink)', fontSize: 10, fontWeight: 900 }}>NA</span>
            <span style={{ lineHeight: 1.3, minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Impostazioni</strong>
              <span style={{ display: 'block', fontSize: 9.5, color: 'var(--muted)' }}>Connessioni</span>
            </span>
            <Settings size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <header style={{
          height: 72, position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 18,
          padding: '0 var(--view-pad-x)', borderBottom: '1px solid var(--line)',
          background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(20px) saturate(1.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--muted)' }}>
              <span>Libreria</span><span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted)', opacity: .5 }}></span>
              <strong style={{ fontWeight: 700, color: 'var(--text-2)' }}>{mediaType === 'radarr' ? 'Film' : 'Serie TV'}</strong>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted)', opacity: .5 }}></span>
              <span>{stats.total} titoli</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto', flex: 'none' }}>
            <button onClick={onRefresh} disabled={refreshing} title="Aggiorna" style={{
              width: 37, height: 37, border: '1px solid var(--line)', borderRadius: 10, background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center'
            }}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
            <button onClick={() => setSettingsOpen(true)} title="Impostazioni" style={{
              width: 37, height: 37, border: '1px solid var(--line)', borderRadius: 10, background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center'
            }}><Settings size={16} /></button>
          </div>
        </header>

        <main>
          <section style={{ display: 'block', width: '100%', maxWidth: 1680, margin: '0 auto', padding: 'var(--view-pad-y) var(--view-pad-x) 112px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 26, marginBottom: 28 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2.5s infinite' }}></span>
                  {mediaType === 'radarr' ? 'Radarr' : 'Sonarr'}
                </div>
                <h1 style={{ margin: '10px 0', fontSize: 'clamp(36px,4.2vw,60px)', lineHeight: .98, letterSpacing: '-.058em', fontWeight: 780, maxWidth: 760 }}>
                  La tua libreria,<br /><em style={{ fontStyle: 'normal', color: 'var(--accent-strong)' }}>sotto controllo.</em>
                </h1>
                <p style={{ maxWidth: 560, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.55 }}>
                  {stats.total} {mediaType === 'radarr' ? 'film' : 'serie'}, {stats.pct}% completo.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={onOpenCustomFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 37, padding: '0 14px', border: '1px solid var(--accent)', borderRadius: 10, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 11.5, fontWeight: 700, boxShadow: '0 8px 22px var(--accent-soft)' }}>
                  <SlidersHorizontal size={14} /> Personalizza
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(294px,.66fr)', gap: 14 }}>
              <section style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) minmax(155px,.55fr)', alignItems: 'center', gap: 24, padding: 24, background: 'linear-gradient(180deg,var(--surface),color-mix(in srgb,var(--surface) 68%,var(--bg)))', border: '1px solid var(--line)', borderRadius: 18, boxShadow: 'var(--shadow)' }}>
                <div style={{ position: 'relative', width: 124, height: 124, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(from -90deg, var(--accent) ${stats.pct}%, var(--surface-3) 0)` }}>
                  <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', background: 'var(--surface)' }}></div>
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'baseline', gap: 1, fontSize: 31, fontWeight: 820, letterSpacing: '-.06em' }}>{stats.pct}<small style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>%</small></div>
                </div>
                <div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Salute libreria</span>
                  <h2 style={{ fontSize: 19, letterSpacing: '-.035em', margin: '5px 0 6px', fontWeight: 750 }}>Quasi tutta la collezione è pronta.</h2>
                  <p style={{ color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.5, maxWidth: 390 }}>Completa i titoli ancora mancanti per raggiungere il 100%.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, borderLeft: '1px solid var(--line)', paddingLeft: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 10 }}>
                    <span style={{ color: 'var(--muted)' }}>Artwork</span><b style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--text-2)' }}>{stats.valid ? Math.round((stats.aH/stats.valid)*100) : 0}%</b>
                    <div style={{ gridColumn: '1/-1', height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', background: 'var(--accent)', width: `${stats.valid ? (stats.aH/stats.valid)*100 : 0}%` }}></i></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 10 }}>
                    <span style={{ color: 'var(--muted)' }}>Tema</span><b style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--text-2)' }}>{stats.valid ? Math.round((stats.tH/stats.valid)*100) : 0}%</b>
                    <div style={{ gridColumn: '1/-1', height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', background: 'var(--accent)', width: `${stats.valid ? (stats.tH/stats.valid)*100 : 0}%` }}></i></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 10 }}>
                    <span style={{ color: 'var(--muted)' }}>Trailer</span><b style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--text-2)' }}>{stats.valid ? Math.round((stats.trH/stats.valid)*100) : 0}%</b>
                    <div style={{ gridColumn: '1/-1', height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', background: 'var(--accent)', width: `${stats.valid ? (stats.trH/stats.valid)*100 : 0}%` }}></i></div>
                  </div>
                </div>
              </section>
              <section style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 11, background: 'linear-gradient(180deg,var(--surface),color-mix(in srgb,var(--surface) 68%,var(--bg)))', border: '1px solid var(--line)', borderRadius: 18, boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Azioni</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 7px', borderRadius: 99, background: 'color-mix(in srgb,var(--warn) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--warn) 28%,transparent)', color: 'var(--warn)', fontSize: 8.5, fontWeight: 700 }}>Da completare</span>
                </div>
                <p style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.45 }}>Usa Editor, Artwork o Download rapido per completare i titoli.</p>
              </section>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', border: '1px solid var(--line)', borderRadius: 13, background: 'color-mix(in srgb,var(--surface) 70%,transparent)' }}>
                <span style={{ width: 31, height: 31, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--accent-strong)' }}><Wand2 size={14} /></span>
                <div><b style={{ display: 'block', fontSize: 14 }}>{stats.tM}</b><span style={{ display: 'block', fontSize: 9, color: 'var(--muted)' }}>Temi mancanti</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', border: '1px solid var(--line)', borderRadius: 13, background: 'color-mix(in srgb,var(--surface) 70%,transparent)' }}>
                <span style={{ width: 31, height: 31, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--accent-strong)' }}><ImageIcon size={14} /></span>
                <div><b style={{ display: 'block', fontSize: 14 }}>{stats.aM}</b><span style={{ display: 'block', fontSize: 9, color: 'var(--muted)' }}>Artwork mancanti</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', border: '1px solid var(--line)', borderRadius: 13, background: 'color-mix(in srgb,var(--surface) 70%,transparent)' }}>
                <span style={{ width: 31, height: 31, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--accent-strong)' }}><Play size={14} /></span>
                <div><b style={{ display: 'block', fontSize: 14 }}>{stats.trM}</b><span style={{ display: 'block', fontSize: 9, color: 'var(--muted)' }}>Trailer mancanti</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', border: '1px solid var(--line)', borderRadius: 13, background: 'color-mix(in srgb,var(--surface) 70%,transparent)' }}>
                <span style={{ width: 31, height: 31, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--accent-strong)' }}><CheckCircle size={14} /></span>
                <div><b style={{ display: 'block', fontSize: 14 }}>{stats.tH + stats.aH + stats.trH}</b><span style={{ display: 'block', fontSize: 9, color: 'var(--muted)' }}>Asset completati</span></div>
              </div>
            </div>

            <section style={{ marginTop: 30 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 13 }}>
                <div>
                  <h2 style={{ fontSize: 20, letterSpacing: '-.04em', fontWeight: 760, display: 'flex', alignItems: 'center', gap: 8 }}>Da completare <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 6px', borderRadius: 99, background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--muted)' }}>{filtered.length}</span></h2>
                  <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3 }}>Clicca su un titolo per aprire editor/artwork.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <button onClick={() => setMainFilter('all')} style={{ height: 28, padding: '0 9px', borderRadius: 99, border: mainFilter === 'all' ? '1px solid var(--accent)' : '1px solid var(--line)', background: mainFilter === 'all' ? 'var(--accent)' : 'transparent', color: mainFilter === 'all' ? 'var(--accent-ink)' : 'var(--muted)', fontSize: 9.5, fontWeight: 600 }}>Tutti</button>
                  <button onClick={() => setMainFilter('missing_theme')} style={{ height: 28, padding: '0 9px', borderRadius: 99, border: mainFilter === 'missing_theme' ? '1px solid var(--accent)' : '1px solid var(--line)', background: mainFilter === 'missing_theme' ? 'var(--accent)' : 'transparent', color: mainFilter === 'missing_theme' ? 'var(--accent-ink)' : 'var(--muted)', fontSize: 9.5, fontWeight: 600 }}>Senza tema</button>
                  <button onClick={() => setMainFilter('missing_art')} style={{ height: 28, padding: '0 9px', borderRadius: 99, border: mainFilter === 'missing_art' ? '1px solid var(--accent)' : '1px solid var(--line)', background: mainFilter === 'missing_art' ? 'var(--accent)' : 'transparent', color: mainFilter === 'missing_art' ? 'var(--accent-ink)' : 'var(--muted)', fontSize: 9.5, fontWeight: 600 }}>Senza artwork</button>
                  <button onClick={() => setMainFilter('missing_trailer')} style={{ height: 28, padding: '0 9px', borderRadius: 99, border: mainFilter === 'missing_trailer' ? '1px solid var(--accent)' : '1px solid var(--line)', background: mainFilter === 'missing_trailer' ? 'var(--accent)' : 'transparent', color: mainFilter === 'missing_trailer' ? 'var(--accent-ink)' : 'var(--muted)', fontSize: 9.5, fontWeight: 600 }}>Senza trailer</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {filtered.map((m) => (
                  <button key={m.id} onClick={() => onOpenEditor(m.id)} style={{ textAlign: 'left', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'color-mix(in srgb,var(--surface) 72%,transparent)' }}>
                    <div style={{ aspectRatio: '2/3', background: 'var(--surface-3)', position: 'relative' }}>
                      {(m as any).poster && <img src={(m as any).poster} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {!m.has_theme && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--muted)' }}>Tema</span>}
                        {!m.has_artwork && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--muted)' }}>Artwork</span>}
                        {!m.has_trailer && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--muted)' }}>Trailer</span>}
                        {m.has_theme && m.has_artwork && m.has_trailer && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}>Completo</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nessun elemento.</div>}
            </section>
          </section>
        </main>
      </div>

      <MediaPlayer />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={() => { loadMedia(); loadRootFolders(); }} />
      <CustomFilterModal open={customFilterOpen} onOpenChange={setCustomFilterOpen} onApply={onApplyCustomFilter} onChanged={() => {}} />
      <EditorModal open={editorOpen} onOpenChange={setEditorOpen} media={currentMedia} mediaType={mediaType} onPreviewResult={onEditorPreview} onChanged={() => { loadMedia(); }} />
      <ArtworkModal open={artworkOpen} onOpenChange={setArtworkOpen} media={currentMedia} mediaType={mediaType} onChanged={() => { loadMedia(); }} />
      <VideoModal open={videoOpen} videoId={videoId} videoUrl={videoUrl} action={videoAction} onClose={() => setVideoOpen(false)} />
    </div>
  );
}
