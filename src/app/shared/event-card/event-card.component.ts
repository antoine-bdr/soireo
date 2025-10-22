// ========================================
// 📦 EVENT CARD COMPONENT
// ========================================
// Composant réutilisable pour afficher une card événement
// Utilisé dans : event-list, favorites, profile, mes-events, etc.

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonText,
  IonChip,
  IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  locationOutline,
  peopleOutline
} from 'ionicons/icons';

import { Event, EventCategory } from './../../core/models/event.model';

@Component({
  selector: 'app-event-card',
  templateUrl: './event-card.component.html',
  styleUrls: ['./event-card.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonText,
    IonChip,
    IonLabel
  ]
})
export class EventCardComponent {
  // ========================================
  // 📥 INPUTS
  // ========================================
  
  /**
   * Événement à afficher
   */
  @Input({ required: true }) event!: Event;
  
  /**
   * Nombre de participants (optionnel, calculé par le parent)
   */
  @Input() participantCount?: number;
  
  /**
   * Afficher ou non le badge "COMPLET"
   * Par défaut : calcul automatique basé sur participantCount
   */
  @Input() showFullBadge?: boolean;

  // ========================================
  // 📤 OUTPUTS
  // ========================================
  
  /**
   * Émis quand l'utilisateur clique sur la card
   */
  @Output() cardClick = new EventEmitter<string>();

  constructor() {
    addIcons({ calendarOutline, locationOutline, peopleOutline });
  }

  // ========================================
  // 🎯 MÉTHODES PUBLIQUES
  // ========================================

  /**
   * Gère le clic sur la card
   */
  onCardClick() {
    if (this.event.id) {
      this.cardClick.emit(this.event.id);
    }
  }

  /**
   * Vérifie si l'événement est complet
   */
  isEventFull(): boolean {
    if (this.showFullBadge !== undefined) {
      return this.showFullBadge;
    }
    
    if (this.participantCount !== undefined) {
      return this.participantCount >= this.event.maxParticipants;
    }
    
    return false;
  }

  /**
   * Retourne la couleur du badge participants
   */
  getParticipantBadgeStatus(): string {
    if (this.isEventFull()) {
      return 'danger';
    }
    
    if (this.participantCount === undefined) {
      return 'success';
    }
    
    const percentage = (this.participantCount / this.event.maxParticipants) * 100;
    
    if (percentage >= 80) {
      return 'warning';
    }
    
    return 'success';
  }

  /**
   * Formate la date pour l'affichage
   */
  formatDate(dateValue: any): string {
    if (!dateValue) return 'Date inconnue';
    
    try {
      let date: Date;
      
      if (dateValue?.toDate) {
        date = dateValue.toDate();
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } else {
        date = dateValue;
      }
      
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      
      return date.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Erreur formatDate:', error);
      return 'Erreur';
    }
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
   * Retourne le nombre de participants à afficher
   */
  getDisplayParticipantCount(): number {
    return this.participantCount ?? 0;
  }
}