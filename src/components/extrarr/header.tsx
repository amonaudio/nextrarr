/**
 * Header — top bar with logo, switch Radarr/Sonarr, refresh, filters, sort,
 * local + global search, theme toggle, settings button, stats line.
 */

'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, RefreshCw, Settings, Search } from 'lucide-react';
import { useExtrarrStore } from '@/store/extrarr-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMemo, useEffect, useState } from 'react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenCustomFilters: () => void;
  onGlobalSearch: (q: string) => void;
  rootFolders: string[];
}

export function Header({ onOpenSettings, onOpenCustomFilters, onGlobalSearch, rootFolders }: HeaderProps) {
  const {
    mediaType, setMediaType,
    sortField, setSortField, sortDir, toggleSortDir,
    rootFolderFilter, setRootFolderFilter,
    mainFilter, setMainFilter,
    localSearch, setLocalSearch,
    mediaList,
  } = useExtrarrStore();
  const { theme, setTheme } = useTheme();
  // next-themes returns undefined theme on first render (SSR). Wait for mount
  // before reading the actual theme — avoids hydration mismatch and broken icon.
  const [mounted, setMounted] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setMounted(true); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    return { tH, tM, aH, aM, trH, trM, valid, total: mediaList.length };
  }, [mediaList]);

  return (
    <header className="border-b border-border pb-3 mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎬</span>
        <h1 className="text-xl font-bold text-primary">nEXTrarr</h1>
        <Badge variant="outline" className="text-xs ml-1">v0.2</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Radarr / Sonarr switch */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mediaType === 'radarr' ? 'default' : 'outline'}
            onClick={() => setMediaType('radarr')}
            className={mediaType === 'radarr' ? 'bg-primary text-primary-foreground' : ''}
          >
            🎬 Radarr
          </Button>
          <Button
            size="sm"
            variant={mediaType === 'sonarr' ? 'default' : 'outline'}
            onClick={() => setMediaType('sonarr')}
            className={mediaType === 'sonarr' ? 'bg-primary text-primary-foreground' : ''}
          >
            📺 Sonarr
          </Button>
        </div>

        <Button size="sm" variant="outline" title="Aggiorna">
          <RefreshCw className="h-4 w-4" />
        </Button>

        <Select value={rootFolderFilter} onValueChange={setRootFolderFilter}>
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="Tutte le Cartelle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le Cartelle Root</SelectItem>
            {rootFolders.map((f) => (
              <SelectItem key={f} value={f}>{f.split('/').pop()}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mainFilter} onValueChange={(v) => {
          if (v === 'custom_open') {
            onOpenCustomFilters();
            return;
          }
          setMainFilter(v);
        }}>
          <SelectTrigger size="sm" className="w-[180px]">
            <SelectValue placeholder="Tutti i Media" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i Media</SelectItem>
            <SelectItem value="missing_theme">❌ Mancanza Tema</SelectItem>
            <SelectItem value="missing_art">❌ Mancanza Artwork</SelectItem>
            <SelectItem value="missing_trailer">❌ Mancanza Trailer</SelectItem>
            <SelectItem value="complete">✅ Completamente Completi</SelectItem>
            <SelectItem value="custom_open">➕ Crea/Modifica Filtri...</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortField} onValueChange={(v) => setSortField(v as 'title' | 'year' | 'date_added')}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Ordina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">Ordina: Titolo</SelectItem>
            <SelectItem value="year">Ordina: Anno</SelectItem>
            <SelectItem value="date_added">Ordina: Data Aggiunta</SelectItem>
          </SelectContent>
        </Select>

        <Button size="sm" variant="outline" onClick={toggleSortDir} title="Direzione">
          {sortDir === 'asc' ? '⬆' : '⬇'}
        </Button>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filtra libreria..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-7 w-[140px] h-8"
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = (new FormData(e.currentTarget).get('q') as string) || '';
            onGlobalSearch(q);
          }}
          className="relative"
        >
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input name="q" placeholder="Cerca su YouTube..." className="pl-7 w-[160px] h-8" />
        </form>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Tema"
        >
          {/* Render a neutral icon until mounted to avoid SSR/CSR mismatch */}
          {mounted ? (theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <Moon className="h-4 w-4" />}
        </Button>

        <Button size="sm" variant="outline" onClick={onOpenSettings} title="Impostazioni">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-full text-center text-xs text-muted-foreground">
        🎵 Tema: {stats.tH}/{stats.valid} | 🖼️ Artwork: {stats.aH}/{stats.valid} | 🎬 Trailer: {stats.trH}/{stats.valid}{' '}
        (Valide: {stats.valid}/{stats.total})
      </div>
    </header>
  );
}
