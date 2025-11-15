// src/app/features/events/event-detail/components/info-segment/info-segment.component.ts
// ✅ VERSION OPTIMISÉE avec meilleure gestion des erreurs

import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonCard, IonCardContent, IonChip, IonLabel, IonIcon, IonAvatar, IonBadge, IonButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline, locationOutline, personOutline, documentTextOutline,
  eyeOffOutline, informationCircleOutline, globeOutline, mailOutline, lockClosedOutline
} from 'ionicons/icons';

import { EventWithConditionalLocation } from '../../../../../core/models/event.model';
import { ParticipantStatus } from '../../../../../core/models/participant.model';
import { EventLocationVisibilityService } from '../../../../../core/services/event-location-visibility.service';
import { AddressDisplayInfo, EventPermissions } from 'src/app/core/models/event-permissions.model';

/**
 * ========================================
 * 📋 SEGMENT INFO - VERSION OPTIMISÉE
 * ========================================
 * 
 * Améliorations :
 * - ✅ Meilleure gestion des dates
 * - ✅ Formatage d'erreurs user-friendly
 * - ✅ ARIA labels
 */
@Component({
  selector: 'app-info-segment',
  templateUrl: './info-segment.component.html',
  styleUrls: ['./info-segment.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton, CommonModule, IonCard, IonCardContent, IonChip, IonLabel,
    IonIcon, IonAvatar, IonBadge
  ]
})
export class InfoSegmentComponent implements OnInit {
  @Input() event!: EventWithConditionalLocation;

  @Input() permissions!: EventPermissions;
  @Input() addressDisplay!: AddressDisplayInfo;

  constructor(
    private locationVisibilityService: EventLocationVisibilityService
  ) {
    addIcons({
      calendarOutline, locationOutline, personOutline, documentTextOutline,
      eyeOffOutline, informationCircleOutline, globeOutline, mailOutline, lockClosedOutline
    });
  }

  ngOnInit() {
    console.log('📋 InfoSegment initialized');
  }

  // ✅ Formatage amélioré avec gestion des erreurs
  formatDate(dateValue: any): string {
    if (!dateValue) return 'Date non disponible';
    
    try {
      let date: Date;
      
      if (dateValue?.toDate) {
        date = dateValue.toDate();
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        return 'Date non disponible';
      }
      
      if (isNaN(date.getTime())) {
        return 'Date non disponible';
      }
      
      // ✅ Formatage français amélioré
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      const formatted = date.toLocaleDateString('fr-FR', options);
      
      // Capitaliser la première lettre
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
      
    } catch (error) {
      console.error('Erreur formatDate:', error);
      return 'Date non disponible';
    }
  }

  getCategoryLabel(category: any): string {
    const categoryStr = String(category).toUpperCase();
    
    const labels: Record<string, string> = {
      'PARTY': '🎉 Soirée',
      'CONCERT': '🎵 Concert',
      'FESTIVAL': '🎪 Festival',
      'BAR': '🍺 Bar',
      'CLUB': '💃 Club',
      'OUTDOOR': '🌳 Extérieur',
      'PRIVATE': '🔒 Privé',
      'OTHER': '📌 Autre'
    };
    
    return labels[categoryStr] || `📌 ${category}`;
  }

  getEventAccessType(): string {
    if (!this.event) return 'public';
    
    const originalEvent = this.event as any;
    
    if (originalEvent.isPrivate) {
      return 'private';
    }
    
    if (originalEvent.requiresApproval) {
      return 'invitation';
    }
    
    return 'public';
  }

  getAccessTypeLabel(): string {
    const type = this.getEventAccessType();
    
    switch (type) {
      case 'public':
        return 'Public';
      case 'invitation':
        return 'Sur invitation';
      case 'private':
        return 'Privé';
      default:
        return 'Public';
    }
  }

  getAccessTypeIcon(): string {
    const type = this.getEventAccessType();
    
    switch (type) {
      case 'public':
        return 'globe-outline';
      case 'invitation':
        return 'mail-outline';
      case 'private':
        return 'lock-closed-outline';
      default:
        return 'globe-outline';
    }
  }
}