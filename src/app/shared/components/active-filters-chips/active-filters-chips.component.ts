// src/app/shared/components/active-filters-chips/active-filters-chips.component.ts
// Composant pour afficher les filtres actifs sous forme de chips animées

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonChip,
  IonIcon,
  IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close,
  search,
  pricetag,
  location,
  calendar,
  checkmarkCircle
} from 'ionicons/icons';
import { SearchFiltersService } from '../../../core/services/search-filters.service';
import { ActiveFilter } from '../../../core/models/search-filters.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-active-filters-chips',
  standalone: true,
  imports: [
    CommonModule,
    IonChip,
    IonIcon,
    IonLabel
  ],
  template: `
    <!-- 🏷️ Container des chips filtres actifs -->
    <div class="active-filters-container" *ngIf="activeFilters.length > 0">
      
      <!-- Chip pour chaque filtre actif -->
      <ion-chip
        *ngFor="let filter of activeFilters; trackBy: trackByFilter"
        class="filter-chip"
        [class.animated]="true"
        (click)="removeFilter(filter)">
        
        <!-- Icône du filtre -->
        <ion-icon 
          *ngIf="filter.icon" 
          [name]="filter.icon">
        </ion-icon>
        
        <!-- Label du filtre -->
        <ion-label>{{ filter.label }}</ion-label>
        
        <!-- Bouton close -->
        <ion-icon 
          name="close" 
          class="close-icon">
        </ion-icon>
      </ion-chip>
      
      <!-- Bouton "Tout effacer" -->
      <ion-chip
        *ngIf="activeFilters.length > 1"
        class="clear-all-chip"
        (click)="clearAllFilters()">
        <ion-label>Tout effacer</ion-label>
        <ion-icon name="close"></ion-icon>
      </ion-chip>
      
    </div>
  `,
  styles: [`
    // ========================================
    // 🎨 STYLES ACTIVE FILTERS CHIPS
    // ========================================
    
    .active-filters-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(
        180deg,
        rgba(15, 20, 35, 0.8) 0%,
        rgba(10, 14, 25, 0.9) 100%
      );
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      
      // Animation d'apparition
      animation: slideDown 0.3s ease-out;
    }
    
    // ========================================
    // 🏷️ CHIPS INDIVIDUELLES
    // ========================================
    
    .filter-chip {
      --background: linear-gradient(
        135deg,
        rgba(255, 45, 85, 0.15) 0%,
        rgba(255, 107, 157, 0.15) 100%
      );
      --color: rgba(255, 179, 198, 1);
      
      height: 32px;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid rgba(255, 107, 157, 0.3);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      // Icône du filtre
      ion-icon:first-child {
        font-size: 16px;
        color: rgba(255, 107, 157, 1);
        margin-right: 4px;
      }
      
      // Icône close
      .close-icon {
        font-size: 18px;
        color: rgba(255, 179, 198, 0.8);
        margin-left: 4px;
        transition: color 0.2s ease;
      }
      
      // Hover
      &:hover {
        --background: linear-gradient(
          135deg,
          rgba(255, 45, 85, 0.25) 0%,
          rgba(255, 107, 157, 0.25) 100%
        );
        border-color: rgba(255, 107, 157, 0.5);
        transform: translateY(-2px);
        
        .close-icon {
          color: rgba(255, 107, 157, 1);
        }
      }
      
      // Active
      &:active {
        transform: translateY(0);
      }
      
      // Animation d'apparition
      &.animated {
        animation: chipFadeIn 0.3s ease-out backwards;
      }
    }
    
    // ========================================
    // 🗑️ BOUTON "TOUT EFFACER"
    // ========================================
    
    .clear-all-chip {
      --background: rgba(255, 45, 85, 0.1);
      --color: rgba(255, 107, 157, 1);
      
      height: 32px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid rgba(255, 45, 85, 0.3);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      ion-icon {
        font-size: 18px;
        margin-left: 4px;
      }
      
      &:hover {
        --background: rgba(255, 45, 85, 0.2);
        border-color: rgba(255, 45, 85, 0.5);
        transform: translateY(-2px);
      }
    }
    
    // ========================================
    // 🎬 ANIMATIONS
    // ========================================
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes chipFadeIn {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    // ========================================
    // 📱 RESPONSIVE
    // ========================================
    
    @media (max-width: 576px) {
      .active-filters-container {
        padding: 8px 12px;
        gap: 6px;
      }
      
      .filter-chip,
      .clear-all-chip {
        height: 28px;
        font-size: 12px;
      }
    }
  `]
})
export class ActiveFiltersChipsComponent implements OnInit, OnDestroy {
  
  // ========================================
  // 📦 SERVICES
  // ========================================
  private readonly filtersService = inject(SearchFiltersService);
  
  // ========================================
  // 🎯 ÉTAT
  // ========================================
  activeFilters: ActiveFilter[] = [];
  private subscription?: Subscription;
  
  constructor() {
    addIcons({
      close,
      search,
      pricetag,
      location,
      calendar,
      checkmarkCircle
    });
  }
  
  ngOnInit() {
    // Écoute les changements de filtres
    this.subscription = this.filtersService.filters$.subscribe(() => {
      this.activeFilters = this.filtersService.getActiveFiltersList();
    });
  }
  
  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
  
  // ========================================
  // 🎯 MÉTHODES
  // ========================================
  
  /**
   * Supprime un filtre
   */
  removeFilter(filter: ActiveFilter): void {
    this.filtersService.removeActiveFilter(filter);
  }
  
  /**
   * Efface tous les filtres
   */
  clearAllFilters(): void {
    this.filtersService.resetFilters();
  }
  
  /**
   * TrackBy pour optimisation Angular
   */
  trackByFilter(index: number, filter: ActiveFilter): string {
    return `${filter.type}-${filter.value}`;
  }
}