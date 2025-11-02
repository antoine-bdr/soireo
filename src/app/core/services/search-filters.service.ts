// src/app/core/services/search-filters.service.ts
// ✅ VERSION FINALE CORRIGÉE - Émission forcée sur filters$

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  SearchFilters,
  DEFAULT_FILTERS,
  ActiveFilter,
  FilterType,
  SortOption
} from '../models/search-filters.model';
import { Event, EventCategory } from '../models/event.model';
import { Timestamp } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class SearchFiltersService {
  
  // ========================================
  // 📊 ÉTAT DES FILTRES (RÉACTIF)
  // ========================================
  
  private filtersSubject = new BehaviorSubject<SearchFilters>(DEFAULT_FILTERS);
  public filters$: Observable<SearchFilters> = this.filtersSubject.asObservable();
  
  // ========================================
  // 🎯 GETTERS
  // ========================================
  
  getCurrentFilters(): SearchFilters {
    return this.filtersSubject.value;
  }
  
  hasActiveFilters(): boolean {
    const filters = this.getCurrentFilters();
    return (
      filters.searchTerm !== '' ||
      filters.categories.length > 0 ||
      filters.cities.length > 0 ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      filters.onlyAvailable ||
      filters.minParticipants !== undefined ||
      filters.maxParticipants !== undefined ||
      !filters.includePrivate
    );
  }
  
  getActiveFiltersCount(): number {
    const filters = this.getCurrentFilters();
    let count = 0;
    
    if (filters.searchTerm) count++;
    if (filters.categories.length > 0) count += filters.categories.length;
    if (filters.cities.length > 0) count += filters.cities.length;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.onlyAvailable) count++;
    if (filters.minParticipants || filters.maxParticipants) count++;
    if (!filters.includePrivate) count++;
    if (filters.accessType !== 'all') count++;
    
    return count;
  }
  
  // ========================================
  // 🔧 SETTERS (MODIFICATION DES FILTRES)
  // ========================================
  
  /**
   * ✅ CORRIGÉ : Force l'émission même si la référence ne change pas
   */
  setFilters(filters: SearchFilters): void {
    console.log('🔍 [SearchFiltersService] setFilters appelé avec:', filters);
    
    // Crée une NOUVELLE référence pour forcer l'émission
    const newFilters = { ...filters };
    this.filtersSubject.next(newFilters);
    
    console.log('📢 [SearchFiltersService] Émission forcée sur filters$');
  }
  
  /**
   * ✅ CORRIGÉ : Crée toujours une nouvelle référence
   */
  updateFilters(partialFilters: Partial<SearchFilters>): void {
    const currentFilters = this.getCurrentFilters();
    
    // ✅ IMPORTANT : Crée une NOUVELLE référence
    const newFilters = {
      ...currentFilters,
      ...partialFilters
    };
    
    console.log('🔍 [SearchFiltersService] updateFilters:', {
      before: currentFilters,
      changes: partialFilters,
      after: newFilters
    });
    
    this.filtersSubject.next(newFilters);
    
    console.log('📢 [SearchFiltersService] Émission sur filters$');
  }
  
  resetFilters(): void {
    console.log('🔄 [SearchFiltersService] Réinitialisation des filtres');
    
    // Crée une NOUVELLE référence
    const newFilters = { ...DEFAULT_FILTERS };
    this.filtersSubject.next(newFilters);
    
    console.log('📢 [SearchFiltersService] Émission forcée sur filters$');
  }
  
  setSearchTerm(term: string): void {
    console.log('🔍 [SearchFiltersService] setSearchTerm:', term);
    this.updateFilters({ searchTerm: term });
  }
  
  setSegment(segment: 'all' | 'upcoming' | 'past'): void {
    console.log('🔍 [SearchFiltersService] setSegment:', segment);
    this.updateFilters({ segment });
  }

  setAccessType(accessType: 'all' | 'public' | 'invitation'): void {
    console.log(`🎫 [SearchFiltersService] setAccessType: ${accessType}`);
    this.updateFilters({ accessType });
  }
  
  toggleCategory(category: EventCategory): void {
    const filters = this.getCurrentFilters();
    
    // ✅ Crée un NOUVEAU tableau
    const categories = [...filters.categories];
    
    const index = categories.indexOf(category);
    if (index > -1) {
      categories.splice(index, 1);
    } else {
      categories.push(category);
    }
    
    console.log('🔍 [SearchFiltersService] toggleCategory:', { category, categories });
    this.updateFilters({ categories });
  }
  
  toggleCity(city: string): void {
    const filters = this.getCurrentFilters();
    
    // ✅ Crée un NOUVEAU tableau
    const cities = [...filters.cities];
    
    const index = cities.indexOf(city);
    if (index > -1) {
      cities.splice(index, 1);
    } else {
      cities.push(city);
    }
    
    console.log('🔍 [SearchFiltersService] toggleCity:', { city, cities });
    this.updateFilters({ cities });
  }
  
  setDateRange(from?: Date, to?: Date): void {
    console.log('🔍 [SearchFiltersService] setDateRange:', { from, to });
    this.updateFilters({ dateFrom: from, dateTo: to });
  }
  
  toggleOnlyAvailable(): void {
    const filters = this.getCurrentFilters();
    const newValue = !filters.onlyAvailable;
    console.log('🔍 [SearchFiltersService] toggleOnlyAvailable:', newValue);
    this.updateFilters({ onlyAvailable: newValue });
  }
  
  setSorting(sortBy: SortOption, sortOrder: 'asc' | 'desc'): void {
    console.log('🔍 [SearchFiltersService] setSorting:', { sortBy, sortOrder });
    this.updateFilters({ sortBy, sortOrder });
  }
  
  // ========================================
  // 🏷️ FILTRES ACTIFS (POUR L'AFFICHAGE)
  // ========================================
  
  getActiveFiltersList(): ActiveFilter[] {
    const filters = this.getCurrentFilters();
    const activeFilters: ActiveFilter[] = [];
    
    if (filters.searchTerm) {
      activeFilters.push({
        type: FilterType.SEARCH,
        label: `"${filters.searchTerm}"`,
        value: filters.searchTerm,
        icon: 'search'
      });
    }
    
    filters.categories.forEach(cat => {
      activeFilters.push({
        type: FilterType.CATEGORY,
        label: this.getCategoryLabel(cat),
        value: cat,
        icon: 'pricetag'
      });
    });
    
    filters.cities.forEach(city => {
      activeFilters.push({
        type: FilterType.CITY,
        label: city,
        value: city,
        icon: 'location'
      });
    });
    
    if (filters.dateFrom || filters.dateTo) {
      const label = this.getDateRangeLabel(filters.dateFrom, filters.dateTo);
      activeFilters.push({
        type: FilterType.DATE_RANGE,
        label,
        value: { from: filters.dateFrom, to: filters.dateTo },
        icon: 'calendar'
      });
    }
    
    if (filters.onlyAvailable) {
      activeFilters.push({
        type: FilterType.AVAILABLE_ONLY,
        label: 'Places disponibles',
        value: true,
        icon: 'checkmark-circle'
      });
    }

    if (filters.accessType !== 'all') {
      const label = filters.accessType === 'public' ? 'Accès public' : 'Sur invitation';
      activeFilters.push({
        type: FilterType.ACCESS_TYPE,
        label: label,
        value: filters.accessType,
        icon: filters.accessType === 'public' ? 'lock-open-outline' : 'mail-outline'
      });
    }
    
    return activeFilters;
  }
  
  removeActiveFilter(filter: ActiveFilter): void {
    console.log('🔍 [SearchFiltersService] removeActiveFilter:', filter);
    
    switch (filter.type) {
      case FilterType.SEARCH:
        this.setSearchTerm('');
        break;
        
      case FilterType.CATEGORY:
        this.toggleCategory(filter.value as EventCategory);
        break;
        
      case FilterType.CITY:
        this.toggleCity(filter.value as string);
        break;
        
      case FilterType.DATE_RANGE:
        this.setDateRange(undefined, undefined);
        break;
        
      case FilterType.AVAILABLE_ONLY:
        this.toggleOnlyAvailable();
        break;

      case FilterType.ACCESS_TYPE:
        this.setAccessType('all');
        break;
    }
  }
  
  // ========================================
  // 🔍 APPLICATION DES FILTRES
  // ========================================
  
  applyFilters(
    events: Event[],
    participantCounts: Map<string, number>
  ): Event[] {
    const filters = this.getCurrentFilters();
    
    console.log('🔍 [SearchFiltersService] applyFilters START:', {
      totalEvents: events.length,
      filters: filters,
      participantCountsSize: participantCounts.size
    });
    
    let filtered = [...events];
    const initialCount = filtered.length;
    
    // 1️⃣ Filtre par terme de recherche
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const beforeCount = filtered.length;
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(term) ||
        event.description.toLowerCase().includes(term) ||
        event.location.city.toLowerCase().includes(term)
      );
      console.log(`  1️⃣ Recherche "${term}": ${beforeCount} → ${filtered.length} événements`);
    }
    
    // 2️⃣ Filtre par segment temporel
    const now = Timestamp.now();
    const beforeSegmentCount = filtered.length;
    
    if (filters.segment === 'upcoming') {
      filtered = filtered.filter(event => {
        const isUpcoming = event.date.toMillis() >= now.toMillis();
        return isUpcoming;
      });
      console.log(`  2️⃣ Segment "upcoming": ${beforeSegmentCount} → ${filtered.length} événements`);
    } else if (filters.segment === 'past') {
      filtered = filtered.filter(event => event.date.toMillis() < now.toMillis());
      console.log(`  2️⃣ Segment "past": ${beforeSegmentCount} → ${filtered.length} événements`);
    } else {
      console.log(`  2️⃣ Segment "all": ${beforeSegmentCount} événements (pas de filtre)`);
    }
    
    // 3️⃣ Filtre par plage de dates personnalisée
    if (filters.dateFrom) {
      const beforeCount = filtered.length;
      const fromTimestamp = Timestamp.fromDate(filters.dateFrom);
      filtered = filtered.filter(event => 
        event.date.toMillis() >= fromTimestamp.toMillis()
      );
      console.log(`  3️⃣ Date FROM ${filters.dateFrom.toLocaleDateString()}: ${beforeCount} → ${filtered.length} événements`);
    }
    if (filters.dateTo) {
      const beforeCount = filtered.length;
      const toTimestamp = Timestamp.fromDate(filters.dateTo);
      filtered = filtered.filter(event => 
        event.date.toMillis() <= toTimestamp.toMillis()
      );
      console.log(`  3️⃣ Date TO ${filters.dateTo.toLocaleDateString()}: ${beforeCount} → ${filtered.length} événements`);
    }
    
    // 4️⃣ Filtre par catégories
    if (filters.categories.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(event =>
        filters.categories.includes(event.category)
      );
      console.log(`  4️⃣ Catégories ${JSON.stringify(filters.categories)}: ${beforeCount} → ${filtered.length} événements`);
    }
    
    // 5️⃣ Filtre par villes
    if (filters.cities.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(event =>
        filters.cities.includes(event.location.city)
      );
      console.log(`  5️⃣ Villes ${JSON.stringify(filters.cities)}: ${beforeCount} → ${filtered.length} événements`);
    }
    
    // 6️⃣ Filtre par disponibilité
    if (filters.onlyAvailable) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(event => {
        const count = participantCounts.get(event.id!) || 0;
        return count < event.maxParticipants;
      });
      console.log(`  6️⃣ Seulement disponibles: ${beforeCount} → ${filtered.length} événements`);
    }
    
    // 7️⃣ Filtre par participants (min/max)
    if (filters.minParticipants !== undefined) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(event => {
        const count = participantCounts.get(event.id!) || 0;
        return count >= filters.minParticipants!;
      });
      console.log(`  7️⃣ Min participants ${filters.minParticipants}: ${beforeCount} → ${filtered.length} événements`);
    }
    if (filters.maxParticipants !== undefined) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(event => {
        const count = participantCounts.get(event.id!) || 0;
        return count <= filters.maxParticipants!;
      });
      console.log(`  7️⃣ Max participants ${filters.maxParticipants}: ${beforeCount} → ${filtered.length} événements`);
    }
    
    // 8️⃣ Filtre privé/public
    if (!filters.includePrivate) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(event => !event.isPrivate);
      console.log(`  8️⃣ Exclure privés: ${beforeCount} → ${filtered.length} événements`);
    }

    if (filters.accessType !== 'all') {
      filtered = this.filterByAccessType(filtered, filters.accessType);
      console.log(`🎫 Après type d'accès "${filters.accessType}":`, filtered.length);
    }
    
    // 9️⃣ Tri
    filtered = this.sortEvents(filtered, participantCounts, filters.sortBy, filters.sortOrder);
    console.log(`  9️⃣ Tri par ${filters.sortBy} (${filters.sortOrder})`);
    
    console.log(`🔍 [SearchFiltersService] applyFilters END: ${initialCount} → ${filtered.length} événements`);
    
    return filtered;
  }
  
  // ========================================
  // 📊 TRI
  // ========================================
  
  private sortEvents(
    events: Event[],
    participantCounts: Map<string, number>,
    sortBy: SortOption,
    sortOrder: 'asc' | 'desc'
  ): Event[] {
    const sorted = [...events];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case SortOption.DATE:
          comparison = a.date.toMillis() - b.date.toMillis();
          break;
          
        case SortOption.POPULARITY:
          const countA = participantCounts.get(a.id!) || 0;
          const countB = participantCounts.get(b.id!) || 0;
          comparison = countA - countB;
          break;
          
        case SortOption.CREATED:
          comparison = a.createdAt.toMillis() - b.createdAt.toMillis();
          break;
          
        case SortOption.TITLE:
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }

  private filterByAccessType(events: Event[], accessType: 'public' | 'invitation'): Event[] {
    return events.filter(event => {
      if (accessType === 'public') {
        return !event.requiresApproval;
      } else {
        return event.requiresApproval;
      }
    });
  }
  
  // ========================================
  // 🛠️ HELPERS
  // ========================================
  
  private getCategoryLabel(category: EventCategory): string {
    const labels: Record<EventCategory, string> = {
      [EventCategory.PARTY]: '🎉 Soirée',
      [EventCategory.CONCERT]: '🎵 Concert',
      [EventCategory.FESTIVAL]: '🎪 Festival',
      [EventCategory.BAR]: '🍺 Bar',
      [EventCategory.CLUB]: '💃 Club',
      [EventCategory.OUTDOOR]: '🌳 Extérieur',
      [EventCategory.PRIVATE]: '🔒 Privé',
      [EventCategory.OTHER]: '📌 Autre'
    };
    return labels[category] || category;
  }
  
  private getDateRangeLabel(from?: Date, to?: Date): string {
    if (from && to) {
      return `${this.formatDate(from)} - ${this.formatDate(to)}`;
    } else if (from) {
      return `Après le ${this.formatDate(from)}`;
    } else if (to) {
      return `Avant le ${this.formatDate(to)}`;
    }
    return 'Dates';
  }
  
  private formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });
  }
  
  // ========================================
  // 💾 SAUVEGARDE DES PRÉFÉRENCES
  // ========================================
  
  saveFiltersToStorage(): void {
    const filters = this.getCurrentFilters();
    localStorage.setItem('partyevents_filters', JSON.stringify(filters));
    console.log('💾 Filtres sauvegardés');
  }
  
  loadFiltersFromStorage(): void {
    const saved = localStorage.getItem('partyevents_filters');
    if (saved) {
      try {
        const filters = JSON.parse(saved);
        this.setFilters(filters);
        console.log('📂 Filtres chargés depuis le stockage');
      } catch (error) {
        console.error('Erreur lors du chargement des filtres:', error);
      }
    }
  }
}