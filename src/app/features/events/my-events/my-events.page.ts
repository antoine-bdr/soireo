// src/app/features/events/my-events/my-events.page.ts
// Page "Mes Événements" - VERSION CORRIGÉE avec cycle de vie Ionic

import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonChip,
  IonSpinner,
  IonText,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonBackButton,
  IonBadge,
  IonAvatar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, 
  locationOutline, 
  peopleOutline,
  addOutline,
  rocketOutline,
  personOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { Event, EventCategory } from '../../../core/models/event.model';
import { switchMap, map, take } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';

@Component({
  selector: 'app-my-events',
  templateUrl: './my-events.page.html',
  styleUrls: ['./my-events.page.scss'],
  standalone: true,
  imports: [
    IonBadge, 
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonChip,
    IonSpinner,
    IonText,
    IonRefresher,
    IonRefresherContent,
    IonButtons,
    IonBackButton,
    RouterLink,
    IonAvatar
  ]
})
export class MyEventsPage implements OnInit, OnDestroy {
  // Injection des services
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

  // 🆕 GESTION DES SUBSCRIPTIONS POUR CLEANUP
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({ 
      calendarOutline, 
      locationOutline, 
      peopleOutline,
      addOutline,
      rocketOutline,
      personOutline
    });
  }

  ngOnInit() {
    // ⚠️ ngOnInit n'est appelé qu'UNE SEULE FOIS à la création de la page
    console.log('🔵 ngOnInit - Première initialisation de MyEventsPage');
    this.loadMyEvents();
  }

  // ========================================
  // 🔄 IONIC LIFECYCLE HOOKS (CRITIQUE !)
  // ========================================

  /**
   * 🚀 ionViewWillEnter : Appelé à CHAQUE fois que la page va apparaître
   * 
   * C'est ici qu'on recharge les données pour avoir toujours les infos à jour.
   * Ce hook est appelé :
   * - À la première visite de la page
   * - Quand on revient sur cette page depuis une autre page
   * - Même si la page est mise en cache par Ionic
   * 
   * ✅ Solution au problème : Les données sont rechargées à chaque retour sur la page
   */
  ionViewWillEnter() {
    console.log('🟢 ionViewWillEnter - La page va apparaître, rechargement des données...');
    
    // 🧹 Nettoie les anciennes subscriptions avant d'en créer de nouvelles
    this.cleanupSubscriptions();
    
    // 🔄 Recharge toutes les données (événements + participants)
    this.loadMyEvents();
  }

  /**
   * 🚪 ionViewWillLeave : Appelé quand l'utilisateur quitte la page
   * 
   * On nettoie les subscriptions pour éviter les fuites mémoire.
   * Les subscriptions continueraient d'écouter Firestore sinon !
   */
  ionViewWillLeave() {
    console.log('🔴 ionViewWillLeave - L\'utilisateur quitte la page, nettoyage...');
    this.cleanupSubscriptions();
  }

  /**
   * 🧹 ngOnDestroy : Filet de sécurité pour le cleanup final
   * 
   * Appelé quand la page est détruite (rare en Ionic car mise en cache).
   * On garde ce hook pour être sûr que tout est nettoyé.
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
   * 🆕 VERSION RÉACTIVE avec stockage des subscriptions
   */
  loadMyEvents() {
    this.isLoading.set(true);
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      console.error('❌ Utilisateur non connecté');
      this.isLoading.set(false);
      return;
    }

    console.log('📥 Chargement des événements pour userId:', userId);

    // 📊 Charge les événements créés par l'utilisateur (temps réel)
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
    // 🔧 FIX : switchMap garantit qu'à chaque changement de participations,
    // on récupère la liste d'événements à jour et on la filtre
    const joinedSub = this.participantsService.getParticipationsByUser(userId).pipe(
      switchMap(participations => {
        console.log(`📝 ${participations.length} participations trouvées`);
        
        // Si aucune participation, retourne un tableau vide immédiatement
        if (participations.length === 0) {
          return of([]);
        }

        // Récupère les IDs des événements
        const eventIds = participations.map(p => p.eventId);
        console.log(`🔍 IDs des événements rejoints:`, eventIds);
        
        // Pour chaque changement de participations, on récupère TOUS les événements
        // et on filtre pour ne garder que ceux où l'utilisateur participe
        return this.eventsService.getAllEvents().pipe(
          map(allEvents => {
            const joined = allEvents.filter(event => 
              eventIds.includes(event.id!) && 
              event.organizerId !== userId
            );
            console.log(`🎉 ${joined.length} événements rejoints filtrés sur ${allEvents.length} événements totaux`);
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
   * 🆕 VERSION avec stockage des subscriptions
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
   * 
   * CRITIQUE : Évite les fuites mémoire et les subscriptions multiples
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
   * 🆕 VERSION avec nettoyage des anciennes subscriptions
   */
  handleRefresh(event: any) {
    console.log('🔄 Pull-to-refresh déclenché');
    
    // Nettoie les anciennes subscriptions
    this.cleanupSubscriptions();
    
    // Recharge tout
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

  /**
   * Retourne la couleur du badge participants
   */
  getParticipantBadgeColor(event: Event): string {
    if (this.isEventFull(event)) {
      return 'danger';
    }
    
    const count = this.getParticipantCount(event.id!);
    const percentage = (count / event.maxParticipants) * 100;
    
    if (percentage >= 80) {
      return 'warning';
    }
    
    return 'success';
  }

  /**
   * Formate la date pour l'affichage
   */
  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleDateString('fr-FR', options);
  }

  /**
   * Retourne le libellé de la catégorie
   */
  getCategoryLabel(category: EventCategory): string {
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

  /**
   * Retourne la couleur de la catégorie
   */
  getCategoryColor(category: EventCategory): string {
    const colors: Record<EventCategory, string> = {
      [EventCategory.PARTY]: 'primary',
      [EventCategory.CONCERT]: 'secondary',
      [EventCategory.FESTIVAL]: 'tertiary',
      [EventCategory.BAR]: 'warning',
      [EventCategory.CLUB]: 'danger',
      [EventCategory.OUTDOOR]: 'success',
      [EventCategory.PRIVATE]: 'medium',
      [EventCategory.OTHER]: 'dark'
    };
    return colors[category] || 'medium';
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

⚠️ SWITCHMAP VS COMBINELATEST :

❌ combineLatestWith() - PROBLÈME :
   - Émet seulement quand LES DEUX sources émettent ensemble
   - Peut manquer des changements si une source émet seule
   - Ne garantit pas la réactivité complète

✅ switchMap() - SOLUTION :
   - À chaque changement de participations, annule l'ancienne subscription
   - Crée une NOUVELLE subscription aux événements
   - Garantit que les données sont toujours fraîches
   - Flux : participations changent → nouvelles requêtes événements → filtrage → UI mise à jou

EXEMPLE DU FLUX AVEC SWITCHMAP :
1. Tu quittes un événement
2. Firestore supprime le document participant
3. getParticipationsByUser() détecte le changement et émet la nouvelle liste
4. switchMap() annule l'ancienne subscription à getAllEvents()
5. switchMap() crée une nouvelle subscription à getAllEvents()
6. Les événements sont filtrés avec les nouvelles participations
7. L'UI est mise à jour automatiquement ! ✨
*/