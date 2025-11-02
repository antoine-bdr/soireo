import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonFooter,
  IonChip,
  IonLabel,
  IonItem,
  IonToggle,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close,
  funnelOutline,
  refreshOutline,
  pricetagOutline,
  calendarOutline,
  locationOutline,
  checkmarkCircleOutline,
  swapVerticalOutline,
  checkmark,
  calendar,
  people,
  flame,
  timeOutline, keyOutline, appsOutline, lockOpenOutline, mailOutline, informationCircleOutline,
 } from 'ionicons/icons';
import { SearchFiltersService } from '../../../core/services/search-filters.service';
import { EventCategory } from '../../../core/models/event.model';
import { SortOption } from '../../../core/models/search-filters.model';

@Component({
  selector: 'app-filter-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonFooter,
    IonChip,
    IonLabel,
    IonItem,
    IonToggle,
    IonDatetime,
    IonDatetimeButton,
    IonModal
  ],
  templateUrl: './filter-modal.component.html',
  styleUrls: ['./filter-modal.component.scss']
})
export class FilterModalComponent implements OnInit {
  
  // ========================================
  // 📦 SERVICES
  // ========================================
  private readonly modalCtrl = inject(ModalController);
  private readonly filtersService = inject(SearchFiltersService);
  
  // ========================================
  // 🎯 DONNÉES TEMPORAIRES (modifiées dans la modal)
  // ========================================
  tempCategories: EventCategory[] = [];
  tempCities: string[] = [];
  tempDateFrom?: string;
  tempDateTo?: string;
  tempOnlyAvailable = false;
  tempIncludePrivate = true;
  tempSortBy?: SortOption;
  tempSortDesc = false;
  tempAccessType: 'all' | 'public' | 'invitation' = 'all';
  
  selectedDateShortcut: string | null = null;
  
  // ========================================
  // 📊 DONNÉES STATIQUES
  // ========================================
  
  // Liste des catégories disponibles
  categories = [
    { value: EventCategory.PARTY, label: 'Soirée', icon: '🎉' },
    { value: EventCategory.CONCERT, label: 'Concert', icon: '🎵' },
    { value: EventCategory.FESTIVAL, label: 'Festival', icon: '🎪' },
    { value: EventCategory.BAR, label: 'Bar', icon: '🍺' },
    { value: EventCategory.CLUB, label: 'Club', icon: '💃' },
    { value: EventCategory.OUTDOOR, label: 'Extérieur', icon: '🌳' },
    { value: EventCategory.PRIVATE, label: 'Privé', icon: '🔒' },
    { value: EventCategory.OTHER, label: 'Autre', icon: '📌' }
  ];
  
  // Liste des villes disponibles (à enrichir dynamiquement)
  availableCities = [
    'Paris',
    'Lyon',
    'Marseille',
    'Toulouse',
    'Nice',
    'Nantes',
    'Bordeaux',
    'Lille',
    'Strasbourg',
    'Rennes'
  ];
  
  // Raccourcis de dates
  dateShortcuts = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'tomorrow', label: 'Demain' },
    { value: 'this-week', label: 'Cette semaine' },
    { value: 'next-week', label: 'Semaine prochaine' },
    { value: 'this-month', label: 'Ce mois-ci' }
  ];
  
  // Options de tri
  sortOptions = [
    { value: SortOption.DATE, label: 'Date', icon: 'calendar' },
    { value: SortOption.POPULARITY, label: 'Popularité', icon: 'flame' },
    { value: SortOption.CREATED, label: 'Récents', icon: 'time-outline' },
    { value: SortOption.TITLE, label: 'Titre', icon: 'text-outline' }
  ];
  
  // Date minimale (aujourd'hui)
  minDate = new Date().toISOString();
  
  // ========================================
  // 🎯 COMPUTED
  // ========================================
  
  get activeFiltersCount(): number {
    let count = 0;
    if (this.tempCategories.length > 0) count += this.tempCategories.length;
    if (this.tempCities.length > 0) count += this.tempCities.length;
    if (this.tempDateFrom || this.tempDateTo) count++;
    if (this.tempOnlyAvailable) count++;
    if (!this.tempIncludePrivate) count++;
    if (this.tempAccessType !== 'all') count++;
    if (this.tempSortBy && this.tempSortBy !== SortOption.DATE) count++;
    return count;
  }
  
  constructor() {
    addIcons({close,funnelOutline,refreshOutline,pricetagOutline,calendarOutline,locationOutline,keyOutline,appsOutline,lockOpenOutline,mailOutline,informationCircleOutline,checkmarkCircleOutline,swapVerticalOutline,checkmark,calendar,people,flame,timeOutline});
  }
  
  ngOnInit() {
    // Charge les filtres actuels
    this.loadCurrentFilters();
  }
  
  // ========================================
  // 📂 CHARGEMENT DES FILTRES ACTUELS
  // ========================================
  
  /**
   * Charge les filtres actuels dans les variables temporaires
   */
  private loadCurrentFilters(): void {
    const filters = this.filtersService.getCurrentFilters();
    
    this.tempCategories = [...filters.categories];
    this.tempCities = [...filters.cities];
    this.tempDateFrom = filters.dateFrom?.toISOString();
    this.tempDateTo = filters.dateTo?.toISOString();
    this.tempOnlyAvailable = filters.onlyAvailable;
    this.tempIncludePrivate = filters.includePrivate;
    this.tempAccessType = filters.accessType;
    this.tempSortBy = filters.sortBy;
    this.tempSortDesc = filters.sortOrder === 'desc';
  }
  
  // ========================================
  // 🎯 CATÉGORIES
  // ========================================
  
  /**
   * Vérifie si une catégorie est sélectionnée
   */
  isCategorySelected(category: EventCategory): boolean {
    return this.tempCategories.includes(category);
  }
  
  /**
   * Toggle une catégorie
   */
  toggleCategory(category: EventCategory): void {
    const index = this.tempCategories.indexOf(category);
    if (index > -1) {
      this.tempCategories.splice(index, 1);
    } else {
      this.tempCategories.push(category);
    }
  }
  
  // ========================================
  // 📅 DATES
  // ========================================
  
  /**
   * Applique un raccourci de date
   */
  applyDateShortcut(shortcut: string): void {
    this.selectedDateShortcut = shortcut;
    const now = new Date();
    
    switch (shortcut) {
      case 'today':
        this.tempDateFrom = now.toISOString();
        this.tempDateTo = new Date(now.setHours(23, 59, 59)).toISOString();
        break;
        
      case 'tomorrow':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.tempDateFrom = tomorrow.toISOString();
        this.tempDateTo = new Date(tomorrow.setHours(23, 59, 59)).toISOString();
        break;
        
      case 'this-week':
        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
        this.tempDateFrom = now.toISOString();
        this.tempDateTo = endOfWeek.toISOString();
        break;
        
      case 'next-week':
        const nextWeekStart = new Date(now);
        nextWeekStart.setDate(nextWeekStart.getDate() + (7 - nextWeekStart.getDay()) + 1);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
        this.tempDateFrom = nextWeekStart.toISOString();
        this.tempDateTo = nextWeekEnd.toISOString();
        break;
        
      case 'this-month':
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        this.tempDateFrom = now.toISOString();
        this.tempDateTo = endOfMonth.toISOString();
        break;
    }
  }
  
  // ========================================
  // 📍 VILLES
  // ========================================
  
  /**
   * Vérifie si une ville est sélectionnée
   */
  isCitySelected(city: string): boolean {
    return this.tempCities.includes(city);
  }
  
  /**
   * Toggle une ville
   */
  toggleCity(city: string): void {
    const index = this.tempCities.indexOf(city);
    if (index > -1) {
      this.tempCities.splice(index, 1);
    } else {
      this.tempCities.push(city);
    }
  }

  selectAccessType(type: 'all' | 'public' | 'invitation'): void {
    console.log(`🎫 [FilterModal] Type d'accès sélectionné: ${type}`);
    this.tempAccessType = type;
  }
  
  // ========================================
  // 📊 TRI
  // ========================================
  
  /**
   * Vérifie si une option de tri est sélectionnée
   */
  isSortSelected(sort: SortOption): boolean {
    return this.tempSortBy === sort;
  }
  
  /**
   * Sélectionne une option de tri
   */
  selectSort(sort: SortOption): void {
    this.tempSortBy = sort;
  }
  
  // ========================================
  // 🔄 ACTIONS
  // ========================================
  
  /**
   * Réinitialise tous les filtres
   */
  resetAllFilters(): void {
    this.tempCategories = [];
    this.tempCities = [];
    this.tempDateFrom = undefined;
    this.tempDateTo = undefined;
    this.tempOnlyAvailable = false;
    this.tempIncludePrivate = true;
    this.tempSortBy = SortOption.DATE;
    this.tempSortDesc = false;
    this.selectedDateShortcut = null;
    this.tempAccessType = 'all';
  }
  
  /**
   * Applique les filtres et ferme la modal
   */
  applyFilters(): void {
    // Convertit les dates ISO en Date
    const dateFrom = this.tempDateFrom ? new Date(this.tempDateFrom) : undefined;
    const dateTo = this.tempDateTo ? new Date(this.tempDateTo) : undefined;
    
    // Met à jour les filtres dans le service
    this.filtersService.updateFilters({
      categories: this.tempCategories,
      cities: this.tempCities,
      dateFrom,
      dateTo,
      onlyAvailable: this.tempOnlyAvailable,
      includePrivate: this.tempIncludePrivate,
      accessType: this.tempAccessType,
      sortBy: this.tempSortBy || SortOption.DATE,
      sortOrder: this.tempSortDesc ? 'desc' : 'asc'
    });
    
    // Ferme la modal
    this.modalCtrl.dismiss({ applied: true });
  }
  
  /**
   * Ferme la modal sans appliquer
   */
  dismiss(): void {
    this.modalCtrl.dismiss({ applied: false });
  }
}