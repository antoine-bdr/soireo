import { Component, OnInit, inject, signal } from '@angular/core';
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
  IonBackButton, IonBadge } from '@ionic/angular/standalone';
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
import { switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-my-events',
  templateUrl: './my-events.page.html',
  styleUrls: ['./my-events.page.scss'],
  standalone: true,
  imports: [IonBadge, 
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
    RouterLink
  ]
})
export class MyEventsPage implements OnInit {
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
    this.loadMyEvents();
  }

  /**
   * Charge les événements de l'utilisateur (créés + participations)
   */
  loadMyEvents() {
    this.isLoading.set(true);
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      console.error('Utilisateur non connecté');
      this.isLoading.set(false);
      return;
    }

    // Charge les événements créés par l'utilisateur
    this.eventsService.getEventsByOrganizer(userId).subscribe({
      next: (events) => {
        this.createdEvents.set(events);
        this.loadParticipantCounts(events);
        console.log(`✅ ${events.length} événements créés`);
        
        // Charge les participations seulement après avoir les événements créés
        this.loadJoinedEvents(userId);
      },
      error: (error) => {
        console.error('Erreur chargement événements créés:', error);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Charge les événements auxquels l'utilisateur participe
   */
  loadJoinedEvents(userId: string) {
    // Récupère les participations de l'utilisateur
    this.participantsService.getParticipationsByUser(userId).pipe(
      // Pour chaque participation, récupère l'événement complet
      switchMap(participations => {
        if (participations.length === 0) {
          return of([]);
        }

        // Récupère les IDs des événements
        const eventIds = participations.map(p => p.eventId);
        
        // Charge tous les événements
        return this.eventsService.getAllEvents().pipe(
          map(allEvents => 
            allEvents.filter(event => 
              eventIds.includes(event.id!) && 
              event.organizerId !== userId // Exclut les événements créés par l'utilisateur
            )
          )
        );
      })
    ).subscribe({
      next: (events) => {
        this.joinedEvents.set(events);
        this.loadParticipantCounts(events);
        this.isLoading.set(false);
        console.log(`✅ ${events.length} événements rejoints`);
      },
      error: (error) => {
        console.error('Erreur chargement événements rejoints:', error);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Charge le nombre de participants pour chaque événement
   */
  loadParticipantCounts(events: Event[]) {
    events.forEach(event => {
      if (event.id) {
        this.participantsService.getParticipantCount(event.id).subscribe({
          next: (count) => {
            this.participantCounts.set(event.id!, count);
          },
          error: (error) => {
            console.error(`Erreur compteur pour ${event.id}:`, error);
            this.participantCounts.set(event.id!, 0);
          }
        });
      }
    });
  }

  /**
   * Retourne la liste d'événements selon l'onglet sélectionné
   */
  getCurrentEvents(): Event[] {
    return this.selectedSegment() === 'created' 
      ? this.createdEvents() 
      : this.joinedEvents();
  }

  /**
   * Change d'onglet
   */
  onSegmentChange(event: any) {
    this.selectedSegment.set(event.detail.value);
  }

  /**
   * Rafraîchit la liste
   */
  handleRefresh(event: any) {
    this.loadMyEvents();
    setTimeout(() => {
      event.target.complete();
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