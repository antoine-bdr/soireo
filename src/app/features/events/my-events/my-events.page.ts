// ========================================
// 🎯 MY EVENTS PAGE - VERSION AVEC EVENT-CARD COMPONENT
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
  IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, 
  addOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { Event } from '../../../core/models/event.model';
import { EventCardComponent } from '../../../shared/event-card/event-card.component';
import { switchMap, map } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';

/**
 * 🎯 MY EVENTS PAGE
 * Affiche les événements créés et les participations de l'utilisateur
 * 
 * Segments :
 * - "Mes créations" : événements créés par l'utilisateur
 * - "Mes participations" : événements où l'utilisateur participe
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
    EventCardComponent
  ]
})
export class MyEventsPage implements OnInit, OnDestroy {
  // Services injectés
  private readonly eventsService = inject(EventsService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);

  // État de la page
  selectedSegment = signal<'created' | 'joined'>('created');
  isLoading = signal(true);
  
  // Listes d'événements
  createdEvents = signal<Event[]>([]);
  joinedEvents = signal<Event[]>([]);
  
  // Map pour les compteurs de participants
  participantCounts = new Map<string, number>();

  // Subscriptions pour cleanup
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({ 
      calendarOutline,
      addOutline
    });
  }

  ngOnInit() {
    console.log('🔵 ngOnInit - Première initialisation de MyEventsPage');
    this.loadMyEvents();
  }

  // ========================================
  // 🔄 IONIC LIFECYCLE HOOKS
  // ========================================

  /**
   * 🚀 ionViewWillEnter : Appelé à CHAQUE fois que la page va apparaître
   * Recharge les données pour avoir toujours les infos à jour
   */
  ionViewWillEnter() {
    console.log('🟢 ionViewWillEnter - Rechargement des données...');
    this.cleanupSubscriptions();
    this.loadMyEvents();
  }

  /**
   * 🚪 ionViewWillLeave : Appelé quand l'utilisateur quitte la page
   * Nettoie les subscriptions pour éviter les fuites mémoire
   */
  ionViewWillLeave() {
    console.log('🔴 ionViewWillLeave - Nettoyage...');
    this.cleanupSubscriptions();
  }

  /**
   * 🧹 ngOnDestroy : Filet de sécurité pour le cleanup final
   */
  ngOnDestroy() {
    console.log('🗑️ ngOnDestroy - Destruction de MyEventsPage');
    this.cleanupSubscriptions();
  }

  // ========================================
  // 📊 CHARGEMENT DES DONNÉES
  // ========================================

  /**
   * Charge les événements de l'utilisateur (créés + participations)
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

    // 📊 Charge les événements rejoints (temps réel avec switchMap)
    const joinedSub = this.participantsService.getParticipationsByUser(userId).pipe(
      switchMap(participations => {
        console.log(`🔍 ${participations.length} participations trouvées`);
        
        if (participations.length === 0) {
          return of([]);
        }

        const eventIds = participations.map(p => p.eventId);
        console.log(`🔍 IDs des événements rejoints:`, eventIds);
        
        return this.eventsService.getAllEvents().pipe(
          map(allEvents => {
            const joined = allEvents.filter(event => 
              eventIds.includes(event.id!) && 
              event.organizerId !== userId
            );
            console.log(`🎉 ${joined.length} événements rejoints filtrés`);
            return joined;
          })
        );
      })
    ).subscribe({
      next: (events) => {
        this.joinedEvents.set(events);
        this.loadParticipantCounts(events);
        this.isLoading.set(false);
        console.log(`✅ ${events.length} événements rejoints chargés`);
      },
      error: (error) => {
        console.error('❌ Erreur chargement événements rejoints:', error);
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(joinedSub);
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
}

// ========================================
// 📚 GUIDE : CYCLE DE VIE IONIC
// ========================================

/*
🔄 ORDRE D'EXÉCUTION DES HOOKS IONIC :

1️⃣ PREMIÈRE VISITE DE LA PAGE :
   ngOnInit() 
   → ionViewWillEnter() 
   → ionViewDidEnter()

2️⃣ NAVIGATION VERS UNE AUTRE PAGE :
   ionViewWillLeave() 
   → ionViewDidLeave()

3️⃣ RETOUR SUR LA PAGE (depuis le cache) :
   ionViewWillEnter() 
   → ionViewDidEnter()
   
   ⚠️ ngOnInit() N'EST PAS RAPPELÉ !

4️⃣ DESTRUCTION DE LA PAGE (rare) :
   ngOnDestroy()

📝 BONNES PRATIQUES :

✅ Utiliser ionViewWillEnter() pour :
   - Recharger les données à chaque visite
   - Mettre à jour l'UI avec les dernières infos
   - S'abonner aux Observables

✅ Utiliser ionViewWillLeave() pour :
   - Nettoyer les subscriptions
   - Sauvegarder l'état si nécessaire
   - Éviter les fuites mémoire

✅ Utiliser ngOnDestroy() comme filet de sécurité :
   - Cleanup final des ressources
   - Rarement appelé en Ionic (mise en cache)

❌ À ÉVITER :
   - Ne PAS compter uniquement sur ngOnInit() pour charger les données
   - Ne PAS oublier de nettoyer les subscriptions
   - Ne PAS créer de nouvelles subscriptions sans nettoyer les anciennes

🎯 RÉSULTAT :
   Les données sont toujours à jour quand tu reviens sur la page !
*/