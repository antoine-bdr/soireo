// ========================================
// 🎯 MY EVENTS PAGE - VERSION AVEC COMPTEURS RÉELS
// ✅ Intégration des notifications et messages
// ========================================

import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, 
  addOutline,
  timeOutline,
  personAddOutline,
  notificationsOutline,
  chatbubblesOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { MessagesService } from '../../../core/services/messages.service';
import { Event } from '../../../core/models/event.model';
import { ParticipantStatus } from '../../../core/models/participant.model';
import { EventCardComponent } from '../../../shared/event-card/event-card.component';
import { switchMap, map } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';

/**
 * 🎯 MY EVENTS PAGE
 * Affiche les événements créés et les participations de l'utilisateur
 * 
 * Segments :
 * - "Mes créations" : événements créés par l'utilisateur
 * - "Participations" : événements où l'utilisateur est APPROVED
 * - "⏳ En attente" : événements où l'utilisateur est PENDING
 */
@Component({
  selector: 'app-my-events',
  templateUrl: './my-events.page.html',
  styleUrls: ['./my-events.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonBadge,
    IonButtons,
    EventCardComponent
  ]
})
export class MyEventsPage implements OnInit, OnDestroy {
  // ========================================
  // 📦 SERVICES
  // ========================================
  private readonly eventsService = inject(EventsService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly authService = inject(AuthenticationService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly messagesService = inject(MessagesService);
  private readonly router = inject(Router);

  // ========================================
  // 🎯 ÉTAT DE LA PAGE
  // ========================================
  selectedSegment = signal<'created' | 'joined' | 'pending'>('created');
  isLoading = signal(true);
  
  // Listes d'événements
  createdEvents = signal<Event[]>([]);
  joinedEvents = signal<Event[]>([]);     // Seulement APPROVED
  pendingEvents = signal<Event[]>([]);    // Seulement PENDING
  
  // Map pour les compteurs de participants
  participantCounts = new Map<string, number>();
  
  // Map pour stocker les statuts de participation
  participationStatuses = new Map<string, ParticipantStatus>();

  // ✅ COMPTEURS RÉELS
  unreadNotificationsCount = signal(0);
  unreadMessagesCount = signal(0);

  // Subscriptions pour cleanup
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({ 
      calendarOutline,
      addOutline,
      timeOutline,
      personAddOutline,
      notificationsOutline,
      chatbubblesOutline
    });
  }

  ngOnInit() {
    console.log('🔵 ngOnInit - Première initialisation de MyEventsPage');
    this.loadMyEvents();
    this.loadCounters(); // ✅ NOUVEAU
  }

  // ========================================
  // 🔄 IONIC LIFECYCLE HOOKS
  // ========================================

  ionViewWillEnter() {
    console.log('🟢 ionViewWillEnter - Rechargement des données...');
    this.cleanupSubscriptions();
    this.loadMyEvents();
    this.loadCounters(); // ✅ NOUVEAU
  }

  ionViewWillLeave() {
    console.log('🔴 ionViewWillLeave - Nettoyage...');
    this.cleanupSubscriptions();
  }

  ngOnDestroy() {
    console.log('🗑️ ngOnDestroy - Destruction de MyEventsPage');
    this.cleanupSubscriptions();
  }

  // ========================================
  // 📊 CHARGEMENT DES DONNÉES
  // ========================================

  /**
   * ✅ Charge et filtre les événements par statut
   */
  loadMyEvents() {
    this.isLoading.set(true);
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      console.error('❌ Utilisateur non connecté');
      this.isLoading.set(false);
      return;
    }

    console.log('🔥 Chargement des événements pour userId:', userId);

    // 📊 Charge les événements créés (temps réel)
    const createdSub = this.eventsService.getEventsByOrganizer(userId).subscribe({
      next: (events) => {
        this.createdEvents.set(events);
        this.loadParticipantCounts(events);
        console.log(`✅ ${events.length} événements créés chargés`);
      },
      error: (error) => {
        console.error('❌ Erreur chargement événements créés:', error);
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(createdSub);

    // ✅ Charge les participations et les filtre par statut
    const participationsSub = this.participantsService.getParticipationsByUser(userId).pipe(
      switchMap(participations => {
        console.log(`🔍 ${participations.length} participations trouvées`);
        
        if (participations.length === 0) {
          return of({ joined: [], pending: [] });
        }

        // Stocker les statuts dans la map
        participations.forEach(p => {
          this.participationStatuses.set(p.eventId, p.status);
        });

        // Séparer les IDs par statut
        const approvedIds = participations
          .filter(p => p.status === ParticipantStatus.APPROVED)
          .map(p => p.eventId);
        
        const pendingIds = participations
          .filter(p => p.status === ParticipantStatus.PENDING)
          .map(p => p.eventId);

        console.log(`✅ ${approvedIds.length} approuvées, ⏳ ${pendingIds.length} en attente`);

        // Charger tous les événements et filtrer
        return this.eventsService.getAllEvents().pipe(
          map(allEvents => {
            // Filtrer les événements où l'utilisateur n'est PAS organisateur
            const joined = allEvents.filter(event => 
              approvedIds.includes(event.id!) && 
              event.organizerId !== userId
            );

            const pending = allEvents.filter(event => 
              pendingIds.includes(event.id!) && 
              event.organizerId !== userId
            );

            console.log(`🎉 ${joined.length} approuvés, ⏳ ${pending.length} en attente`);
            return { joined, pending };
          })
        );
      })
    ).subscribe({
      next: ({ joined, pending }) => {
        this.joinedEvents.set(joined);
        this.pendingEvents.set(pending);
        this.loadParticipantCounts([...joined, ...pending]);
        this.isLoading.set(false);
        console.log(`✅ Chargement terminé`);
      },
      error: (error) => {
        console.error('❌ Erreur chargement participations:', error);
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(participationsSub);
  }

  /**
   * Charge le nombre de participants pour chaque événement (temps réel)
   */
  loadParticipantCounts(events: Event[]) {
    events.forEach(event => {
      if (event.id) {
        const countSub = this.participantsService.getParticipantCount(event.id).subscribe({
          next: (count) => {
            this.participantCounts.set(event.id!, count);
          },
          error: (error) => {
            console.error(`❌ Erreur compteur pour ${event.id}:`, error);
            this.participantCounts.set(event.id!, 0);
          }
        });
        this.subscriptions.push(countSub);
      }
    });
  }

  /**
   * ✅ NOUVEAU : Charge les compteurs de notifications et messages
   */
  loadCounters() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      console.warn('⚠️ [MyEventsPage] Utilisateur non connecté');
      return;
    }

    // Compteur de notifications
    const notifSub = this.notificationsService.getUnreadCount(userId).subscribe({
      next: (count) => {
        this.unreadNotificationsCount.set(count);
        console.log(`🔔 [MyEventsPage] ${count} notifications non lues`);
      },
      error: (error) => {
        console.error('❌ [MyEventsPage] Erreur chargement notifications:', error);
      }
    });
    this.subscriptions.push(notifSub);

    // Compteur de messages
    const messagesSub = this.messagesService.getUnreadMessagesCount(userId).subscribe({
      next: (count) => {
        this.unreadMessagesCount.set(count);
        console.log(`💬 [MyEventsPage] ${count} messages non lus`);
      },
      error: (error) => {
        console.error('❌ [MyEventsPage] Erreur chargement messages:', error);
      }
    });
    this.subscriptions.push(messagesSub);
  }

  /**
   * 🧹 Nettoie toutes les subscriptions actives
   */
  private cleanupSubscriptions() {
    console.log(`🧹 Nettoyage de ${this.subscriptions.length} subscriptions...`);
    
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    
    this.subscriptions = [];
    console.log('✅ Subscriptions nettoyées');
  }

  // ========================================
  // 🔄 ACTIONS UTILISATEUR
  // ========================================

  /**
   * Change d'onglet
   */
  onSegmentChange(event: any) {
    this.selectedSegment.set(event.detail.value);
    console.log('🔀 Changement d\'onglet:', event.detail.value);
  }

  /**
   * Rafraîchit la liste (pull-to-refresh)
   */
  handleRefresh(event: any) {
    console.log('🔄 Pull-to-refresh déclenché');
    this.cleanupSubscriptions();
    this.loadMyEvents();
    this.loadCounters(); // ✅ NOUVEAU
    
    setTimeout(() => {
      event.target.complete();
      console.log('✅ Refresh terminé');
    }, 1000);
  }

  /**
   * Navigation vers la création d'événement
   */
  goToCreateEvent() {
    this.router.navigate(['/events/create']);
  }

  /**
   * Navigation vers le détail d'un événement
   */
  goToEventDetail(eventId: string) {
    this.router.navigate(['/events', eventId]);
  }

  // ========================================
  // 🧭 NAVIGATION SOCIAL
  // ========================================

  /**
   * Navigation vers la recherche d'amis
   */
  goToFriendSearch() {
    console.log('👥 [MyEventsPage] Navigation vers recherche d\'amis');
    this.router.navigate(['/social/friend-search']);
  }

  /**
   * Navigation vers les notifications
   */
  goToNotifications() {
    console.log('🔔 [MyEventsPage] Navigation vers notifications');
    this.router.navigate(['/social/notifications']);
  }

  /**
   * Navigation vers la messagerie
   */
  goToMessages() {
    console.log('💬 [MyEventsPage] Navigation vers messages');
    this.router.navigate(['/social/messages']);
  }

  // ========================================
  // 🎨 HELPERS D'AFFICHAGE
  // ========================================

  /**
   * Retourne le nombre de participants pour un événement
   */
  getParticipantCount(eventId: string): number {
    return this.participantCounts.get(eventId) || 0;
  }

  /**
   * Vérifie si un événement est complet
   */
  isEventFull(event: Event): boolean {
    const count = this.getParticipantCount(event.id!);
    return count >= event.maxParticipants;
  }

  /**
   * ✅ Retourne le statut de participation pour un événement
   */
  getParticipationStatus(eventId: string): ParticipantStatus | undefined {
    return this.participationStatuses.get(eventId);
  }
}