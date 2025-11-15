// src/app/core/services/event-location-visibility.service.ts
// ✅ REFACTORÉ (ÉTAPE 4) - Logique simplifiée

import { Injectable } from '@angular/core';
import { 
  Event, 
  EventLocation, 
  MaskedEventLocation, 
  AddressVisibility,
  EventWithConditionalLocation 
} from '../models/event.model';
import { ParticipantStatus } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class EventLocationVisibilityService {

  constructor() {}

  /**
   * ✅ SIMPLIFIÉ : Détermine si l'utilisateur peut voir l'adresse complète
   * RÈGLE UNIFIÉE : Organisateur ou APPROVED uniquement
   */
  canSeeFullAddress(
    event: Event,
    currentUserId: string,
    participantStatus?: ParticipantStatus
  ): boolean {
    // Organisateur voit toujours
    if (event.organizerId === currentUserId) {
      return true;
    }

    // ✅ NOUVELLE RÈGLE UNIFIÉE : APPROVED uniquement
    return participantStatus === ParticipantStatus.APPROVED;
  }

  /**
   * Retourne l'Event avec adresse masquée si nécessaire
   */
  getEventWithMaskedLocation(
    event: Event,
    currentUserId: string,
    participantStatus?: ParticipantStatus
  ): EventWithConditionalLocation {
    
    const canSee = this.canSeeFullAddress(event, currentUserId, participantStatus);

    if (canSee) {
      return {
        ...event,
        canSeeFullAddress: true
      };
    } else {
      return {
        ...event,
        location: this.maskLocation(event.location),
        canSeeFullAddress: false
      };
    }
  }

  /**
   * ✅ SIMPLIFIÉ : Masque une localisation
   */
  private maskLocation(location: EventLocation): MaskedEventLocation {
    // ✅ Message unique pour tous
    const message = "L'adresse complète sera révélée une fois votre participation confirmée";

    return {
      city: location.city,
      zipCode: location.zipCode,
      country: location.country,
      approximateLatitude: location.approximateLatitude || location.latitude,
      approximateLongitude: location.approximateLongitude || location.longitude,
      visibility: AddressVisibility.PARTICIPANTS_ONLY,
      message: message
    };
  }

  /**
   * Calcule les coordonnées approximatives
   */
  calculateApproximateCoordinates(
    latitude: number,
    longitude: number
  ): { approximateLatitude: number; approximateLongitude: number } {
    const latOffset = (Math.random() - 0.5) * 0.02;
    const lngOffset = (Math.random() - 0.5) * 0.02;

    return {
      approximateLatitude: latitude + latOffset,
      approximateLongitude: longitude + lngOffset
    };
  }

  /**
   * Coordonnées pour la carte
   */
  getMapCoordinates(
    location: EventLocation | MaskedEventLocation
  ): { latitude: number; longitude: number } {
    
    if ('address' in location) {
      return {
        latitude: location.latitude,
        longitude: location.longitude
      };
    } else {
      return {
        latitude: location.approximateLatitude || 0,
        longitude: location.approximateLongitude || 0
      };
    }
  }

  /**
   * Formate l'adresse pour l'affichage
   */
  formatAddressForDisplay(
    location: EventLocation | MaskedEventLocation
  ): string {
    
    if ('address' in location) {
      return `${location.address}, ${location.zipCode} ${location.city}`;
    } else {
      return `${location.city}${location.zipCode ? ' (' + location.zipCode + ')' : ''}`;
    }
  }

  /**
   * Vérifie si une localisation est masquée
   */
  isLocationMasked(location: EventLocation | MaskedEventLocation): boolean {
    return !('address' in location);
  }
}