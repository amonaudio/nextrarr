/**
 * Header — top bar with logo, switch Radarr/Sonarr, refresh, filters, sort,
 * local + global search, theme toggle, settings button, stats line.
 *
 * [0.7.10] CHANGES:
 *   - Header is now `sticky top-0 z-50` so it stays visible while scrolling.
 *     Background is semi-transparent with backdrop-blur for a modern feel.
 *     Previously the header scrolled away with the page — all controls
 *     disappeared when the user scrolled down to browse cards.
 *   - Added shadcn Tooltip to all icon-only buttons (Refresh, Direction,
 *     Theme toggle, Settings). Buttons with text labels already have
 *     clear visible text, but icon-only buttons need tooltips for
 *     discoverability.
 *   - Radarr/Sonarr switch buttons now have tooltips too.
 */

'use client';

import { useTheme } from 'next-themes';
import {
  Moon, Sun, RefreshCw, Settings, Search,
  Film, Tv, Music, Image as ImageIcon, Clapperboard,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { useExtrarrStore } from '@/store/extrarr-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenCustomFilters: () => void;
  onGlobalSearch: (q: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  rootFolders: string[];
}

export function Header({ onOpenSettings, onOpenCustomFilters, onGlobalSearch, onRefresh, refreshing = false, rootFolders }: HeaderProps) {
  const {
    mediaType, setMediaType,
    sortField, setSortField, sortDir, toggleSortDir,
    rootFolderFilter, setRootFolderFilter,
    mainFilter, setMainFilter,
    localSearch, setLocalSearch,
    mediaList,
  } = useExtrarrStore();
  const { theme, setTheme } = useTheme();
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

  const themeColor = stats.tH === stats.valid && stats.valid > 0
    ? 'text-green-500 border-green-500/30 bg-green-500/10'
    : stats.tH > 0
      ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
      : 'text-muted-foreground border-border bg-muted/30';
  const artColor = stats.aH === stats.valid && stats.valid > 0
    ? 'text-green-500 border-green-500/30 bg-green-500/10'
    : stats.aH > 0
      ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
      : 'text-muted-foreground border-border bg-muted/30';
  const trailerColor = stats.trH === stats.valid && stats.valid > 0
    ? 'text-green-500 border-green-500/30 bg-green-500/10'
    : stats.trH > 0
      ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
      : 'text-muted-foreground border-border bg-muted/30';

  return (
    // [0.7.10] Sticky header — stays at top while scrolling.
    // z-50 to stay above alpha-nav (z-40) and cards.
    // backdrop-blur + bg-background/95 for a "frosted glass" effect.
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="nEXTrarr" className="h-8 w-8 shrink-0" />
          <h1 className="text-xl font-bold text-primary">nEXTrarr</h1>
          <Badge variant="outline" className="text-xs ml-1">v0.8.32</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Radarr / Sonarr switch with tooltips */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted/30 border border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={mediaType === 'radarr' ? 'default' : 'ghost'}
                  onClick={() => setMediaType('radarr')}
                  className={cn(
                    'gap-1.5',
                    mediaType === 'radarr' && 'bg-primary text-primary-foreground shadow-sm'
                  )}
                >
                  <Film className="h-4 w-4" />
                  <span className="hidden sm:inline">Radarr</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Passa a Radarr (film)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={mediaType === 'sonarr' ? 'default' : 'ghost'}
                  onClick={() => setMediaType('sonarr')}
                  className={cn(
                    'gap-1.5',
                    mediaType === 'sonarr' && 'bg-primary text-primary-foreground shadow-sm'
                  )}
                >
                  <Tv className="h-4 w-4" />
                  <span className="hidden sm:inline">Sonarr</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Passa a Sonarr (serie TV)</TooltipContent>
            </Tooltip>
          </div>

          {/* Refresh button with tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={refreshing}
                className="gap-1.5"
              >
                <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                <span className="hidden lg:inline">{refreshing ? 'Aggiornamento...' : 'Aggiorna'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aggiorna libreria (ricarica da Radarr/Sonarr e pulisce le cache)</TooltipContent>
          </Tooltip>

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
              <SelectItem value="missing_theme">Mancanza Tema</SelectItem>
              <SelectItem value="missing_art">Mancanza Artwork</SelectItem>
              <SelectItem value="missing_trailer">Mancanza Trailer</SelectItem>
              <SelectItem value="complete">Completamente Completi</SelectItem>
              <SelectItem value="custom_open">Crea/Modifica Filtri...</SelectItem>
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

          {/* Direction button with tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={toggleSortDir}
                className="px-2"
              >
                {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {sortDir === 'asc' ? 'Ordine crescente (clicca per decrescente)' : 'Ordine decrescente (clicca per crescente)'}
            </TooltipContent>
          </Tooltip>

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

          {/* Theme toggle with tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="px-2"
              >
                {mounted ? (theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {mounted ? (theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro') : 'Cambia tema'}
            </TooltipContent>
          </Tooltip>

          {/* Settings button with tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={onOpenSettings} className="px-2">
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Impostazioni (API key, mappatura percorsi, ecc.)</TooltipContent>
          </Tooltip>
        </div>

        {/* Stats row with tooltips on each badge */}
        <div className="w-full flex items-center justify-center gap-2 flex-wrap text-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <Badge
                  variant="outline"
                  className={cn('gap-1.5 py-1 px-2 font-medium cursor-help', themeColor)}
                >
                  <Music className="h-3.5 w-3.5" />
                  <span>Tema</span>
                  <span className="font-mono tabular-nums">{stats.tH}/{stats.valid}</span>
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Temi musicali presenti: {stats.tH} di {stats.valid} ({stats.tM} mancanti)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <Badge
                  variant="outline"
                  className={cn('gap-1.5 py-1 px-2 font-medium cursor-help', artColor)}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Artwork</span>
                  <span className="font-mono tabular-nums">{stats.aH}/{stats.valid}</span>
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Artwork presenti: {stats.aH} di {stats.valid} ({stats.aM} mancanti)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <Badge
                  variant="outline"
                  className={cn('gap-1.5 py-1 px-2 font-medium cursor-help', trailerColor)}
                >
                  <Clapperboard className="h-3.5 w-3.5" />
                  <span>Trailer</span>
                  <span className="font-mono tabular-nums">{stats.trH}/{stats.valid}</span>
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Trailer presenti: {stats.trH} di {stats.valid} ({stats.trM} mancanti)
            </TooltipContent>
          </Tooltip>
          <span className="text-muted-foreground text-xs ml-1">
            (Valide: <span className="font-mono tabular-nums">{stats.valid}</span>/{stats.total})
          </span>
        </div>
      </div>
    </header>
  );
}
