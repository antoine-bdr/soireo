// src/app/features/events/event-list/event-list.page.ts
// Page de liste de tous les événements

import { Component, OnInit, inject, signal } from '@angular/core';
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
  IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  addOutline, 
  calendarOutline, 
  locationOutline, 
  peopleOutline,
  searchOutline,
  filterOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { Event, EventCategory } from '../../../core/models/event.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
    IonRefresherContent
  ]
})
export class EventListPage implements OnInit {
  // Injection des services
  private readonly eventsService = inject(EventsService);
  private readonly router = inject(Router);

  // État de la page
  events$ = signal<Observable<Event[]> | null>(null);
  filteredEvents = signal<Event[]>([]);
  isLoading = signal(true);
  
  // Filtres
  searchTerm = signal('');
  selectedSegment = signal<'all' | 'upcoming'>('upcoming');

  constructor() {
    addIcons({ 
      addOutline, 
      calendarOutline, 
      locationOutline, 
      peopleOutline,
      searchOutline,
      filterOutline
    });
  }

  ngOnInit() {
    this.loadEvents();
  }

  /**
   * Charge les événements depuis Firestore
   */
  loadEvents() {
    this.isLoading.set(true);
    
    // Choix entre tous les événements ou seulement les à venir
    const eventsObservable = this.selectedSegment() === 'all' 
      ? this.eventsService.getAllEvents()
      : this.eventsService.getUpcomingEvents();

    // Subscribe pour mettre à jour filteredEvents
    eventsObservable.subscribe({
      next: (events) => {
        this.filteredEvents.set(events);
        this.isLoading.set(false);
        console.log(`✅ ${events.length} événements chargés`);
      },
      error: (error) => {
        console.error('❌ Erreur de chargement:', error);
        this.isLoading.set(false);
      }
    });
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
    this.eventsService.searchEvents(term).subscribe(events => {
      this.filteredEvents.set(events);
    });
  }

  /**
   * Change le filtre (tous / à venir)
   */
  onSegmentChange(event: any) {
    this.selectedSegment.set(event.detail.value);
    this.loadEvents();
  }

  /**
   * Rafraîchir la liste (pull-to-refresh)
   */
  handleRefresh(event: any) {
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

  /**
   * Vérifie si l'événement est complet
   */
  isEventFull(event: Event): boolean {
    return event.currentParticipants >= event.maxParticipants;
  }
}