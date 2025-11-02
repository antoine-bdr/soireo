// src/app/core/models/search-filters.model.ts
// Modèle pour les filtres de recherche avancée

import { EventCategory } from './event.model';

/**
 * 🔍 Interface pour les filtres de recherche
 */
export interface SearchFilters {
  // 📝 Recherche textuelle
  searchTerm: string;
  
  // 📅 Filtres temporels
  dateFrom?: Date;
  dateTo?: Date;
  segment: 'all' | 'upcoming' | 'past';
  
  // 🎭 Filtres par catégorie
  categories: EventCategory[];
  
  // 📍 Filtres géographiques
  cities: string[];
  
  // 👥 Filtres participants
  minParticipants?: number;
  maxParticipants?: number;
  onlyAvailable: boolean; // Uniquement événements avec places disponibles
  
  // 🔒 Filtres privé/public
  includePrivate: boolean;

  accessType: 'all' | 'public' | 'invitation';
  
  // 🎯 Tri
  sortBy: SortOption;
  sortOrder: 'asc' | 'desc';
}

/**
 * 📊 Options de tri disponibles
 */
export enum SortOption {
  DATE = 'date',
  POPULARITY = 'popularity', // Nombre de participants
  CREATED = 'createdAt',
  TITLE = 'title'
}

/**
 * 🎨 Interface pour les filtres actifs (affichage chips)
 */
export interface ActiveFilter {
  type: FilterType;
  label: string;
  value: any;
  icon?: string;
}

/**
 * 🏷️ Types de filtres disponibles
 */
export enum FilterType {
  SEARCH = 'search',
  DATE_RANGE = 'dateRange',
  CATEGORY = 'category',
  ACCESS_TYPE = 'accessType',
  CITY = 'city',
  PARTICIPANTS = 'participants',
  AVAILABLE_ONLY = 'availableOnly',
  SORT = 'sort'
}

/**
 * 💾 Interface pour la sauvegarde des préférences
 */
export interface SearchPreferences {
  lastUsedFilters: Partial<SearchFilters>;
  favoriteSearches: SavedSearch[];
}

/**
 * ⭐ Recherche sauvegardée
 */
export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  createdAt: Date;
}

/**
 * 🎯 Valeurs par défaut des filtres
 */
export const DEFAULT_FILTERS: SearchFilters = {
  searchTerm: '',
  segment: 'upcoming',
  accessType: 'all',
  categories: [],
  cities: [],
  onlyAvailable: false,
  includePrivate: true,
  sortBy: SortOption.DATE,
  sortOrder: 'asc'
};