// src/app/features/events/event-list/event-list.page.ts
// ✅ VERSION FINALE - Setup filters listener GARANTI

import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonButtons,
  IonBadge,
  IonText,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  add,
  addOutline,
  calendarOutline,
  searchOutline,
  funnelOutline,
  funnel,
  closeCircle
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { SearchFiltersService } from '../../../core/services/search-filters.service';
import { Event } from '../../../core/models/event.model';
import { Subscription } from 'rxjs';

// ✨ IMPORTS DES COMPOSANTS
import { EventCardComponent } from '../../../shared/event-card/event-card.component';
import { ActiveFiltersChipsComponent } from '../../../shared/components/active-filters-chips/active-filters-chips.component';
import { FilterModalComponent } from '../../../shared/components/filter-modal/filter-modal.component';

@Component({
  selector: 'app-event-list',
  templateUrl: './event-list.page.html',
  styleUrls: ['./event-list.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonButtons,
    IonBadge,
    IonText,
    EventCardComponent,
    ActiveFiltersChipsComponent
  ]
})
export class EventListPage implements OnInit, OnDestroy {
  // ========================================
  // 📦 SERVICES
  // ========================================
  private readonly eventsService = inject(EventsService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly filtersService = inject(SearchFiltersService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  // ========================================
  // 🎯 ÉTAT DE LA PAGE
  // ========================================
  
  allEvents = signal<Event[]>([]);
  private filtersVersion = signal(0);
  
  filteredEvents = computed(() => {
    const version = this.filtersVersion();
    console.log(`🔄 [EventListPage] filteredEvents computed recalcul (version ${version})`);
    
    const result = this.filtersService.applyFilters(
      this.allEvents(),
      this.participantCounts()
    );
    
    console.log(`✅ [EventListPage] Événements filtrés: ${result.length}/${this.allEvents().length}`);
    return result;
  });
  
  isLoading = signal(true);
  
  // ========================================
  // 🔍 FILTRES
  // ========================================
  
  searchValue = signal('');
  
  searchTerm = computed(() => {
    this.filtersVersion();
    return this.filtersService.getCurrentFilters().searchTerm;
  });
  
  selectedSegment = computed(() => {
    this.filtersVersion();
    return this.filtersService.getCurrentFilters().segment;
  });
  
  activeFiltersCount = computed(() => {
    this.filtersVersion();
    return this.filtersService.getActiveFiltersCount();
  });

  // ========================================
  // 👥 PARTICIPANTS
  // ========================================
  
  participantCounts = signal(new Map<string, number>());

  // ========================================
  // 🧹 GESTION DES SUBSCRIPTIONS
  // ========================================
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({
      calendarOutline,
      addOutline,
      add,
      searchOutline,
      funnelOutline,
      funnel,
      closeCircle
    });
    
    effect(() => {
      const term = this.searchTerm();
      if (this.searchValue() !== term) {
        this.searchValue.set(term);
        console.log(`🔄 [EventListPage] Sync searchValue: "${term}"`);
      }
    });
  }

  ngOnInit() {
    console.log('🚀 [EventListPage] ngOnInit START');
    
    // ✅ CRITIQUE : Appeler setupFiltersListener() EN PREMIER
    console.log('📡 [EventListPage] Étape 1: Setup filters listener...');
    this.setupFiltersListener();
    
    // Ensuite charger les événements
    console.log('📡 [EventListPage] Étape 2: Load events...');
    this.loadEvents();
    
    console.log('✅ [EventListPage] ngOnInit END');
  }

  ngOnDestroy() {
    console.log('🧹 [EventListPage] ngOnDestroy - cleaning subscriptions');
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
  }

  // ========================================
  // 📡 CHARGEMENT DES DONNÉES
  // ========================================

  loadEvents() {
    console.log('📡 [EventListPage] Chargement des événements...');
    this.isLoading.set(true);
    
    const eventsObservable = this.eventsService.getAllEvents();

    const eventsSub = eventsObservable.subscribe({
      next: (events) => {
        console.log(`✅ [EventListPage] ${events.length} événements reçus de Firestore`);
        this.allEvents.set(events);
        this.isLoading.set(false);
        this.loadParticipantCounts(events);
      },
      error: (error) => {
        console.error('❌ [EventListPage] Erreur de chargement:', error);
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(eventsSub);
  }

  loadParticipantCounts(events: Event[]) {
    console.log(`👥 [EventListPage] Chargement des compteurs de participants pour ${events.length} événements`);
    
    if (this.subscriptions.length > 1) {
      this.subscriptions.slice(1).forEach(sub => sub.unsubscribe());
      this.subscriptions = [this.subscriptions[0]];
    }

    events.forEach(event => {
      if (event.id) {
        const countSub = this.participantsService.getParticipantCount(event.id).subscribe({
          next: (count) => {
            const updated = new Map(this.participantCounts());
            updated.set(event.id!, count);
            this.participantCounts.set(updated);
            console.log(`👥 [EventListPage] Compteur mis à jour: ${event.title} = ${count} participants`);
          }
        });
        this.subscriptions.push(countSub);
      }
    });
  }

  /**
   * ✅ CRITIQUE : Setup du listener sur filters$
   * Cette méthode DOIT être appelée pour que les filtres fonctionnent !
   */
  setupFiltersListener() {
    console.log('👂 [EventListPage] Setup filters listener START');
    
    const filtersSub = this.filtersService.filters$.subscribe((filters) => {
      console.log('🔔 [EventListPage] ✨✨✨ NOTIFICATION DE CHANGEMENT DE FILTRES ✨✨✨');
      console.log('🔔 [EventListPage] Nouveaux filtres:', filters);
      
      // Incrémente filtersVersion pour déclencher les recalculs
      const newVersion = this.filtersVersion() + 1;
      this.filtersVersion.set(newVersion);
      
      console.log(`🔄 [EventListPage] filtersVersion incrémenté: ${newVersion}`);
    });
    
    this.subscriptions.push(filtersSub);
    console.log('👂 [EventListPage] Setup filters listener END - listener actif !');
  }

  // ========================================
  // 👥 MÉTHODES PARTICIPANTS
  // ========================================

  getParticipantCount(eventId: string): number {
    return this.participantCounts().get(eventId) || 0;
  }

  // ========================================
  // 🔍 RECHERCHE & FILTRES
  // ========================================

  onSearchChange(event: any) {
    const term = event.detail.value || '';
    console.log(`🔍 [EventListPage] onSearchChange: "${term}"`);
    
    this.searchValue.set(term);
    this.filtersService.setSearchTerm(term.toLowerCase());
  }

  onSegmentChange(event: any) {
    const segment = event.detail.value as 'all' | 'upcoming' | 'past';
    console.log(`📅 [EventListPage] onSegmentChange: ${segment}`);
    this.filtersService.setSegment(segment);
  }

  async openFiltersModal() {
    console.log('🎚️ [EventListPage] Ouverture de la modal des filtres');
    
    const modal = await this.modalCtrl.create({
      component: FilterModalComponent,
      cssClass: 'filter-modal',
      presentingElement: document.querySelector('ion-router-outlet') || undefined
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    
    if (data?.applied) {
      console.log('✅ [EventListPage] Filtres appliqués depuis la modal');
    } else {
      console.log('❌ [EventListPage] Modal fermée sans appliquer');
    }
  }

  clearFilters() {
    console.log('🗑️ [EventListPage] Effacement de tous les filtres');
    this.filtersService.resetFilters();
  }

  handleRefresh(event: any) {
    console.log('🔄 [EventListPage] Pull-to-refresh');
    
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    // ✅ Recréer le listener après le refresh
    this.setupFiltersListener();
    this.loadEvents();
    
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  // ========================================
  // 🧭 NAVIGATION
  // ========================================

  goToCreateEvent() {
    console.log('➕ [EventListPage] Navigation vers création d\'événement');
    this.router.navigate(['/events/create']);
  }

  goToEventDetail(eventId: string) {
    console.log(`👁️ [EventListPage] Navigation vers détail événement: ${eventId}`);
    this.router.navigate(['/events', eventId]);
  }

  // ========================================
  // 🛠️ HELPERS
  // ========================================

  trackByEventId(index: number, event: Event): string {
    return event.id || index.toString();
  }
}