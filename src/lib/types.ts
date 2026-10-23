/**
 * Shared TypeScript types used across the nEXTrarr UI.
 */

export type MediaType = 'radarr' | 'sonarr';

export interface MediaItem {
  id: number;
  title: string;
  year: number | string;
  poster: string;
  has_theme: boolean;
  has_artwork: boolean;
  has_trailer: boolean;
  is_mapped: boolean;
  folder_exists: boolean;
  root_folder: string;
  local_path: string;
  date_added: string;
}

export interface CustomFilterRule {
  type: 'has_theme' | 'has_artwork' | 'has_trailer';
  val: 'true' | 'false';
}

export interface CustomFilter {
  id?: string;
  name: string;
  rules: CustomFilterRule[];
}

export interface ArtworkItem {
  our_type: string;
  ext: string;
  url: string;
  lang: string;
  likes: string;
}

export interface YouTubeSearchResult {
  title: string;
  url: string;
  video_id: string;
}

export type SortField = 'title' | 'year' | 'date_added';
export type SortDir = 'asc' | 'desc';
export type FilterType = 'all' | 'missing_theme' | 'missing_art' | 'missing_trailer' | 'complete' | 'custom_active' | 'custom_open';
