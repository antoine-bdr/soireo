// src/app/features/events/event-list/event-list.page.ts
// Liste des événements - VERSION COMPLÈTE avec réactivité temps réel

import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
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
  IonBadge,
  IonText,
  IonFab,
  IonFabButton,
  IonChip,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  addOutline, 
  calendarOutline, 
  locationOutline, 
  peopleOutline,
  searchOutline,
  filterOutline,
  personOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { Event, EventCategory } from '../../../core/models/event.model';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-event-list',
  templateUrl: './event-list.page.html',
  styleUrls: ['./event-list.page.scss'],
  standalone: true,
  imports: [
    IonButtons, 
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonBadge,
    IonText,
    IonFab,
    IonFabButton,
    IonChip,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    RouterLink
  ]
})
export class EventListPage implements OnInit, OnDestroy {
  // Injection des services
  private readonly eventsService = inject(EventsService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly router = inject(Router);

  // État de la page
  events$ = signal<Observable<Event[]> | null>(null);
  filteredEvents = signal<Event[]>([]);
  isLoading = signal(true);
  
  // Filtres
  searchTerm = signal('');
  selectedSegment = signal<'all' | 'upcoming'>('upcoming');

  // Map pour stocker le nombre de participants par événement
  participantCounts = new Map<string, number>();

  // 🆕 GESTION DES SUBSCRIPTIONS POUR CLEANUP
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({
      personOutline,
      calendarOutline,
      addOutline,
      peopleOutline,
      locationOutline,
      searchOutline,
      filterOutline
    });
  }

  ngOnInit() {
    this.loadEvents();
  }

  // 🆕 CLEANUP DES SUBSCRIPTIONS
  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    console.log('🧹 EventListPage destroyed - subscriptions cleaned');
  }

  /**
   * Charge les événements depuis Firestore
   * 🆕 VERSION avec stockage des subscriptions
   */
  loadEvents() {
    this.isLoading.set(true);
    
    // Choix entre tous les événements ou seulement les à venir
    const eventsObservable = this.selectedSegment() === 'all' 
      ? this.eventsService.getAllEvents()
      : this.eventsService.getUpcomingEvents();

    // Subscribe pour mettre à jour filteredEvents
    const eventsSub = eventsObservable.subscribe({
      next: (events) => {
        this.filteredEvents.set(events);
        this.isLoading.set(false);
        
        // Charge le nombre de participants pour chaque événement
        this.loadParticipantCounts(events);
        
        console.log(`✅ ${events.length} événements chargés`);
      },
      error: (error) => {
        console.error('❌ Erreur de chargement:', error);
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(eventsSub);
  }

  /**
   * Charge le nombre de participants pour tous les événements (temps réel)
   * 🆕 VERSION avec gestion des subscriptions
   * @param events Liste des événements
   */
  loadParticipantCounts(events: Event[]) {
    // Nettoie les anciennes subscriptions de compteurs (garde la première qui est pour les événements)
    if (this.subscriptions.length > 1) {
      this.subscriptions.slice(1).forEach(sub => sub.unsubscribe());
      this.subscriptions = [this.subscriptions[0]];
    }

    events.forEach(event => {
      if (event.id) {
        // Souscrit au compteur en temps réel pour chaque événement
        const countSub = this.participantsService.getParticipantCount(event.id).subscribe({
          next: (count) => {
            this.participantCounts.set(event.id!, count);
          },
          error: (error) => {
            console.error(`Erreur compteur pour ${event.id}:`, error);
            this.participantCounts.set(event.id!, 0);
          }
        });
        this.subscriptions.push(countSub);
      }
    });
  }

  /**
   * Récupère le nombre de participants pour un événement
   * @param eventId ID de l'événement
   * @returns Nombre de participants
   */
  getParticipantCount(eventId: string): number {
    return this.participantCounts.get(eventId) || 0;
  }

  /**
   * Vérifie si un événement est complet
   * @param event Événement à vérifier
   * @returns true si complet
   */
  isEventFull(event: Event): boolean {
    const count = this.getParticipantCount(event.id!);
    return count >= event.maxParticipants;
  }

  /**
   * Retourne la couleur du badge participants
   * @param event Événement
   * @returns Couleur Ionic
   */
  getParticipantBadgeColor(event: Event): string {
    if (this.isEventFull(event)) {
      return 'danger'; // Rouge si complet
    }
    
    const count = this.getParticipantCount(event.id!);
    const percentage = (count / event.maxParticipants) * 100;
    
    if (percentage >= 80) {
      return 'warning'; // Orange si presque complet (80%+)
    }
    
    return 'success'; // Vert si places disponibles
  }

  /**
   * Recherche dans les événements
   */
  onSearchChange(event: any) {
    const term = event.detail.value?.toLowerCase() || '';
    this.searchTerm.set(term);

    if (!term) {
      // Si pas de recherche, recharge tous les événements
      this.loadEvents();
      return;
    }

    // Recherche dans les événements
    const searchSub = this.eventsService.searchEvents(term).subscribe(events => {
      this.filteredEvents.set(events);
      // Recharge aussi les compteurs pour les résultats de recherche
      this.loadParticipantCounts(events);
    });

    // Remplace l'ancienne subscription de recherche
    if (this.subscriptions.length > 0) {
      this.subscriptions[0].unsubscribe();
      this.subscriptions[0] = searchSub;
    }
  }

  /**
   * Change le filtre (tous / à venir)
   */
  onSegmentChange(event: any) {
    this.selectedSegment.set(event.detail.value);
    
    // Nettoie et recharge
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    this.loadEvents();
  }

  /**
   * Rafraîchir la liste (pull-to-refresh)
   * 🆕 VERSION avec nettoyage des subscriptions
   */
  handleRefresh(event: any) {
    // Nettoie et recharge
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    this.loadEvents();
    
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