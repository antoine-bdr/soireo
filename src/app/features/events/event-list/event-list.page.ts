// src/app/features/events/event-list/event-list.page.ts
// ✅ VERSION DEBUG - Avec outils de diagnostic

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
  ModalController,
  AlertController  // ✅ AJOUTÉ pour le debug
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  add,
  addOutline,
  calendarOutline,
  searchOutline,
  funnelOutline,
  funnel,
  closeCircle,
  personAddOutline,
  notificationsOutline,
  chatbubblesOutline,
  bugOutline  // ✅ AJOUTÉ pour le bouton debug
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { SearchFiltersService } from '../../../core/services/search-filters.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { MessagesService } from '../../../core/services/messages.service';
import { Event } from '../../../core/models/event.model';
import { Subscription } from 'rxjs';

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
  private readonly notificationsService = inject(NotificationsService);
  private readonly authService = inject(AuthenticationService);
  private readonly messagesService = inject(MessagesService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);  // ✅ AJOUTÉ
  private readonly router = inject(Router);

  // ========================================
  // 🎯 ÉTAT DE LA PAGE
  // ========================================
  
  allEvents = signal<Event[]>([]);
  private filtersVersion = signal(0);

  // ✅ COMPTEURS RÉELS
  unreadNotificationsCount = signal(0);
  unreadMessagesCount = signal<number>(0);
  
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
  // ✅ CORRECT
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({
      personAddOutline,
      notificationsOutline,
      chatbubblesOutline,
      funnelOutline,
      calendarOutline,
      closeCircle,
      addOutline,
      add,
      searchOutline,
      funnel,
      bugOutline  // ✅ AJOUTÉ
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
    
    console.log('📡 [EventListPage] Étape 1: Setup filters listener...');
    this.setupFiltersListener();
    
    console.log('📡 [EventListPage] Étape 2: Load events...');
    this.loadEvents();

    this.loadMessagesCount();
    
    // ✅ SOLUTION : Retarder loadCounters pour laisser le temps à l'auth de s'initialiser
    console.log('📡 [EventListPage] Étape 3: Load counters (delayed)...');
    setTimeout(() => {
      console.log('⏰ [EventListPage] Timeout exécuté - appel de loadCounters()');
      this.loadCounters();
    }, 300); // 300ms de délai
    
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

  /**
 * 📨 Charge le compteur de messages non lus en temps réel
 */
private loadMessagesCount() {
  const currentUser = this.authService.currentUser();
  if (!currentUser) return;

  const sub = this.messagesService.getUnreadMessagesCount(currentUser.uid).subscribe({
    next: (count) => {
      this.unreadMessagesCount.set(count);
      console.log(`📨 Messages non lus: ${count}`);
    },
    error: (err) => {
      console.error('❌ Erreur chargement compteur messages:', err);
      this.unreadMessagesCount.set(0);
    }
  });

  this.subscriptions.push(sub);
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
   * ✅ Charge les compteurs de notifications et messages
   */
  loadCounters() {
    const userId = this.authService.getCurrentUserId();
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🎬 [EventListPage] loadCounters() START');
    console.log('🎬 [EventListPage] userId connecté:', userId);
    console.log('🎬 [EventListPage] Type du userId:', typeof userId);
    console.log('🎬 [EventListPage] userId est null?', userId === null);
    console.log('🎬 [EventListPage] userId est undefined?', userId === undefined);
    console.log('🎬 [EventListPage] userId est falsy?', !userId);
    console.log('═══════════════════════════════════════════════════');
    
    if (!userId) {
      console.warn('⚠️ [EventListPage] ⚠️ ATTENTION: Utilisateur non connecté - ARRÊT');
      console.warn('⚠️ [EventListPage] Le badge ne peut pas s\'afficher sans userId');
      return;
    }

    console.log('🔔 [EventListPage] ✅ UserId OK, appel de notificationsService.getUnreadCount()');

    // Compteur de notifications (temps réel)
    const notifSub = this.notificationsService.getUnreadCount(userId).subscribe({
      next: (count) => {
        console.log('═══════════════════════════════════════════════════');
        console.log(`🔔 [EventListPage] 🎯 NEXT APPELÉ avec count=${count}`);
        console.log(`🔔 [EventListPage] Type du count: ${typeof count}`);
        console.log(`🔔 [EventListPage] Avant set: unreadNotificationsCount=${this.unreadNotificationsCount()}`);
        this.unreadNotificationsCount.set(count);
        console.log(`🔔 [EventListPage] Après set: unreadNotificationsCount=${this.unreadNotificationsCount()}`);
        console.log(`🔔 [EventListPage] Le badge devrait s'afficher? ${count > 0 ? 'OUI ✅' : 'NON ❌'}`);
        console.log('═══════════════════════════════════════════════════');
      },
      error: (error) => {
        console.error('═══════════════════════════════════════════════════');
        console.error('❌ [EventListPage] ERREUR dans subscribe notifications:', error);
        console.error('❌ [EventListPage] Type d\'erreur:', error.constructor.name);
        console.error('❌ [EventListPage] Message:', error.message);
        console.error('❌ [EventListPage] Stack:', error.stack);
        console.error('═══════════════════════════════════════════════════');
      },
      complete: () => {
        console.log('✅ [EventListPage] Subscribe notifications COMPLETE');
      }
    });
    
    console.log('🔔 [EventListPage] Subscription créée:', notifSub);
    console.log('🔔 [EventListPage] Subscription closed?', notifSub.closed);
    this.subscriptions.push(notifSub);
    console.log('🔔 [EventListPage] loadCounters() END');
    console.log('═══════════════════════════════════════════════════');
  }

  // ========================================
  // 🐛 MÉTHODES DE DEBUG
  // ========================================

  /**
   * 🐛 Méthode de debug pour vérifier le userId et les compteurs
   */
  async debugNotifications() {
    const userId = this.authService.getCurrentUserId();
    
    const debugInfo = `
═══════════════════════════════════════
🐛 DEBUG - INFORMATIONS NOTIFICATIONS
═══════════════════════════════════════

📋 UTILISATEUR:
• UserId: ${userId || 'NULL / UNDEFINED'}
• Type: ${typeof userId}
• Est null: ${userId === null}
• Est undefined: ${userId === undefined}

📊 COMPTEURS:
• unreadNotificationsCount(): ${this.unreadNotificationsCount()}
• unreadMessagesCount(): ${this.unreadMessagesCount()}

🔗 SUBSCRIPTIONS:
• Nombre total: ${this.subscriptions.length}
• Actives: ${this.subscriptions.filter(s => !s.closed).length}
• Fermées: ${this.subscriptions.filter(s => s.closed).length}

⚙️ SERVICE:
• NotificationsService injecté: ${!!this.notificationsService}

═══════════════════════════════════════
    `.trim();

    console.log(debugInfo);

    const alert = await this.alertCtrl.create({
      header: '🐛 Debug Notifications',
      message: debugInfo,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Forcer compteur à 5',
          handler: () => {
            console.log('🧪 TEST: Forçage du compteur à 5');
            this.unreadNotificationsCount.set(5);
            console.log('✅ Compteur forcé. Le badge devrait s\'afficher avec "5"');
          }
        },
        {
          text: 'Recharger compteurs',
          handler: () => {
            console.log('🔄 Rechargement des compteurs...');
            this.loadCounters();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * 🧪 Test simple pour vérifier si le badge s'affiche
   */
  testBadge() {
    console.log('🧪 TEST: Forçage du compteur à 999');
    this.unreadNotificationsCount.set(999);
    console.log('✅ Si le badge "999" apparaît maintenant, le template fonctionne');
    console.log('✅ Si le badge n\'apparaît pas, problème dans le template ou CSS');
    
    setTimeout(() => {
      console.log('🔄 Reset du compteur à 0 dans 5 secondes...');
      this.unreadNotificationsCount.set(0);
      this.loadCounters();
    }, 5000);
  }

  /**
   * ✅ CRITIQUE : Setup du listener sur filters$
   */
  setupFiltersListener() {
    console.log('👂 [EventListPage] Setup filters listener START');
    
    const filtersSub = this.filtersService.filters$.subscribe((filters) => {
      console.log('📢 [EventListPage] ✨✨✨ NOTIFICATION DE CHANGEMENT DE FILTRES ✨✨✨');
      console.log('📢 [EventListPage] Nouveaux filtres:', filters);
      
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

  // ========================================
  // 🧭 NAVIGATION SOCIAL
  // ========================================

  goToFriendSearch() {
    console.log('👥 [EventListPage] Navigation vers recherche d\'amis');
    this.router.navigate(['/social/friend-search']);
  }

  goToNotifications() {
    console.log('🔔 [EventListPage] Navigation vers notifications');
    this.router.navigate(['/social/notifications']);
  }

  goToMessages() {
    console.log('💬 [EventListPage] Navigation vers messages');
    this.router.navigate(['/social/messages']);
  }

  async openFiltersModal() {
    console.log('🎛️ [EventListPage] Ouverture de la modal des filtres');
    
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
    
    this.setupFiltersListener();
    this.loadEvents();
    this.loadCounters();
    
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