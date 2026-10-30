'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Film,
  FolderCog,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Tv,
  Youtube,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useExtrarrStore } from '@/store/extrarr-store';

type PaletteMode = 'command' | 'youtube';

interface CommandPaletteProps {
  open: boolean;
  mode: PaletteMode;
  onOpenChange: (open: boolean) => void;
  onGlobalSearch: (query: string) => void;
  onOpenSettings: () => void;
  onOpenCustomFilters: () => void;
  onOpenEditor: (id: number) => void;
  onRefresh: () => void;
}

export function CommandPalette({
  open,
  mode,
  onOpenChange,
  onGlobalSearch,
  onOpenSettings,
  onOpenCustomFilters,
  onOpenEditor,
  onRefresh,
}: CommandPaletteProps) {
  const { mediaType, setMediaType, mediaList, setMainFilter, setActiveCustomFilter } = useExtrarrStore();
  const [query, setQuery] = useState('');

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setQuery('');
    onOpenChange(next);
  }, [onOpenChange]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handleOpenChange(!open);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleOpenChange]);

  const mediaResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mediaList.slice(0, 7);
    return mediaList.filter((media) => media.title.toLowerCase().includes(q)).slice(0, 14);
  }, [mediaList, query]);

  const search = query.trim();
  const sourceLabel = mediaType === 'radarr' ? 'film' : 'serie';

  function run(action: () => void) {
    handleOpenChange(false);
    window.setTimeout(action, 0);
  }

  function showIncomplete() {
    setActiveCustomFilter(null);
    setMainFilter('incomplete');
    document.getElementById('library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openFilter(filter: string) {
    setActiveCustomFilter(null);
    setMainFilter(filter);
    document.getElementById('library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Ricerca e comandi"
      description="Cerca nella libreria, esegui azioni o cerca un tema su YouTube."
      className="command-palette-dialog"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={mode === 'youtube' ? 'Cerca un tema o trailer su YouTube...' : 'Cerca nella libreria o esegui un comando...'}
      />
      <CommandList className="command-palette-list">
        <CommandEmpty>Nessun risultato.</CommandEmpty>

        {search && (
          <CommandGroup heading="YouTube">
            <CommandItem value={`youtube-${search}`} onSelect={() => run(() => onGlobalSearch(search))}>
              <Youtube className="h-4 w-4 text-primary" />
              <div className="palette-copy">
                <strong>Cerca “{search}” su YouTube</strong>
                <span>Tema musicale o trailer</span>
              </div>
            </CommandItem>
          </CommandGroup>
        )}

        {mediaResults.length > 0 && (
          <CommandGroup heading={`${sourceLabel} in libreria`}>
            {mediaResults.map((media) => (
              <CommandItem
                key={media.id}
                value={`${media.title} ${media.year}`}
                onSelect={() => run(() => onOpenEditor(media.id))}
              >
                {mediaType === 'radarr' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                <div className="palette-copy">
                  <strong>{media.title}</strong>
                  <span>{media.year} · {media.has_theme ? 'Tema' : 'Senza tema'} · {media.has_artwork ? 'Artwork' : 'Senza artwork'} · {media.has_trailer ? 'Trailer' : 'Senza trailer'}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!search && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Azioni rapide">
              <CommandItem value="completa mancanti" onSelect={() => run(showIncomplete)}>
                <Sparkles className="h-4 w-4" />
                Completa i mancanti
              </CommandItem>
              <CommandItem value="filtro tema" onSelect={() => run(() => openFilter('missing_theme'))}>
                <Search className="h-4 w-4" />
                Mostra titoli senza tema
              </CommandItem>
              <CommandItem value="filtro artwork" onSelect={() => run(() => openFilter('missing_art'))}>
                <Search className="h-4 w-4" />
                Mostra titoli senza artwork
              </CommandItem>
              <CommandItem value="filtro trailer" onSelect={() => run(() => openFilter('missing_trailer'))}>
                <Search className="h-4 w-4" />
                Mostra titoli senza trailer
              </CommandItem>
              <CommandItem value="filtro completi" onSelect={() => run(() => openFilter('complete'))}>
                <CheckCircle2 className="h-4 w-4" />
                Mostra titoli completi
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading="Workspace">
              <CommandItem value="passa a film radarr" onSelect={() => run(() => setMediaType('radarr'))}>
                <Film className="h-4 w-4" />
                Passa a Radarr
              </CommandItem>
              <CommandItem value="passa a serie sonarr" onSelect={() => run(() => setMediaType('sonarr'))}>
                <Tv className="h-4 w-4" />
                Passa a Sonarr
              </CommandItem>
              <CommandItem value="filtri personalizzati" onSelect={() => run(onOpenCustomFilters)}>
                <FolderCog className="h-4 w-4" />
                Filtri personalizzati
              </CommandItem>
              <CommandItem value="aggiorna libreria" onSelect={() => run(onRefresh)}>
                <RefreshCw className="h-4 w-4" />
                Aggiorna libreria
              </CommandItem>
              <CommandItem value="impostazioni" onSelect={() => run(onOpenSettings)}>
                <Settings className="h-4 w-4" />
                Impostazioni
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
      <div className="palette-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> naviga</span>
        <span><kbd>↵</kbd> seleziona</span>
        <span><kbd>esc</kbd> chiudi</span>
      </div>
    </CommandDialog>
  );
}
