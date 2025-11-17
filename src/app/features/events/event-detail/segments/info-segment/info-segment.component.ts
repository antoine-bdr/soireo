import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonCard, IonCardContent, IonChip, IonLabel, IonIcon, IonBadge, IonAvatar 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline, locationOutline, personOutline, documentTextOutline,
  globeOutline, mailOutline, lockClosedOutline, informationCircleOutline 
} from 'ionicons/icons';

import { EventWithConditionalLocation, EventAccessType } from '../../../../../core/models/event.model';
import { EventPermissions, AddressDisplayInfo } from '../../../../../core/models/event-permissions.model';

@Component({
  selector: 'app-info-segment',
  templateUrl: './info-segment.component.html',
  styleUrls: ['./info-segment.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonAvatar, CommonModule, IonCard, IonCardContent, IonChip, IonLabel, IonIcon, IonBadge
  ]
})
export class InfoSegmentComponent implements OnInit {
  @Input() event!: EventWithConditionalLocation;
  @Input() permissions!: EventPermissions;
  @Input() addressDisplay!: AddressDisplayInfo | null;

  constructor() {
    addIcons({
      calendarOutline, locationOutline, informationCircleOutline, 
      personOutline, documentTextOutline, globeOutline, mailOutline, lockClosedOutline
    });
  }

  ngOnInit() {}

  formatDate(dateValue: any): string {
    if (!dateValue) return 'Date non disponible';
    try {
      const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Date non disponible';
    }
  }

  getCategoryLabel(category: string): string {
    const labels: {[key: string]: string} = {
      'PARTY': '🎉 Soirée',
      'CONCERT': '🎵 Concert',
      'FESTIVAL': '🎪 Festival',
      'BAR': '🍺 Bar',
      'CLUB': '💃 Club',
      'OUTDOOR': '🌳 Extérieur',
      'PRIVATE': '🔒 Privé',
      'OTHER': '📌 Autre'
    };
    return labels[category?.toUpperCase()] || '📌 Autre';
  }

  // AJOUT de la méthode manquante
  getEventAccessType(): string {
    if (!this.event) return 'public';
    
    // Récupérer accessType ou déterminer depuis les propriétés legacy
    const eventData = this.event as any;
    
    if (eventData.accessType) {
      return eventData.accessType;
    }
    
    // Compatibilité avec les anciens événements
    if (eventData.isPrivate) {
      return 'private';
    }
    
    if (eventData.requiresApproval) {
      return 'invitation';
    }
    
    return 'public';
  }

  getAccessTypeLabel(): string {
    if (!this.event) return 'Public';
    
    const eventData = this.event as any;
    const accessType = eventData.accessType || this.getEventAccessType();
    
    switch (accessType) {
      case EventAccessType.PUBLIC:
      case 'public':
        return 'Public';
      case EventAccessType.PRIVATE:
      case 'private':
        return 'Privé';
      case EventAccessType.INVITE_ONLY:
      case 'invite_only':
      case 'invitation':
        return 'Sur invitation';
      default:
        return 'Public';
    }
  }

  getAccessTypeIcon(): string {
    if (!this.event) return 'globe-outline';
    
    const eventData = this.event as any;
    const accessType = eventData.accessType || this.getEventAccessType();
    
    switch (accessType) {
      case EventAccessType.PUBLIC:
      case 'public':
        return 'globe-outline';
      case EventAccessType.PRIVATE:
      case 'private':
        return 'lock-closed-outline';
      case EventAccessType.INVITE_ONLY:
      case 'invite_only':
      case 'invitation':
        return 'mail-outline';
      default:
        return 'globe-outline';
    }
  }
}