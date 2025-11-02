// src/app/core/services/event-location-visibility.service.ts
// Service de gestion de la visibilité des adresses

import { Injectable } from '@angular/core';
import { 
  Event, 
  EventLocation, 
  MaskedEventLocation, 
  AddressVisibility,
  EventWithConditionalLocation 
} from '../models/event.model';
import { ParticipantStatus } from '../models/participant.model';

/**
 * ========================================
 * SERVICE : Gestion de la visibilité des adresses
 * ========================================
 * 
 * Responsabilités :
 * - Déterminer si un utilisateur peut voir l'adresse complète
 * - Masquer l'adresse selon le niveau de confidentialité
 * - Fournir des coordonnées approximatives pour la carte
 */
@Injectable({
  providedIn: 'root'
})
export class EventLocationVisibilityService {

  constructor() {}

  /**
   * ========================================
   * Détermine si l'utilisateur peut voir l'adresse complète
   * ========================================
   */
  canSeeFullAddress(
    event: Event,
    currentUserId: string,
    participantStatus?: ParticipantStatus
  ): boolean {
    
    // 1️⃣ L'organisateur voit TOUJOURS l'adresse complète
    if (event.organizerId === currentUserId) {
      return true;
    }

    // 2️⃣ Vérifier la visibilité de l'événement
    const visibility = event.location.visibility;

    switch (visibility) {
      
      case AddressVisibility.PUBLIC:
        // Tout le monde peut voir l'adresse
        return true;

      case AddressVisibility.CITY_ONLY:
        // Seuls les participants ACCEPTÉS peuvent voir l'adresse
        return participantStatus === ParticipantStatus.APPROVED;

      case AddressVisibility.PARTICIPANTS_ONLY:
        // Seuls les participants ACCEPTÉS peuvent voir l'adresse
        return participantStatus === ParticipantStatus.APPROVED;

      default:
        return false;
    }
  }

  /**
   * ========================================
   * Retourne l'Event avec adresse masquée si nécessaire
   * ========================================
   */
  getEventWithMaskedLocation(
    event: Event,
    currentUserId: string,
    participantStatus?: ParticipantStatus
  ): EventWithConditionalLocation {
    
    const canSee = this.canSeeFullAddress(event, currentUserId, participantStatus);

    if (canSee) {
      // L'utilisateur peut voir l'adresse complète
      return {
        ...event,
        canSeeFullAddress: true
      };
    } else {
      // Masquer l'adresse
      return {
        ...event,
        location: this.maskLocation(event.location),
        canSeeFullAddress: false
      };
    }
  }

  /**
   * ========================================
   * Masque une localisation
   * ========================================
   */
  private maskLocation(location: EventLocation): MaskedEventLocation {
    
    let message = '';

    switch (location.visibility) {
      case AddressVisibility.CITY_ONLY:
        message = "L'adresse exacte sera révélée après acceptation de votre participation";
        break;
      case AddressVisibility.PARTICIPANTS_ONLY:
        message = "L'adresse exacte est visible uniquement aux participants acceptés";
        break;
      default:
        message = "Adresse non disponible";
    }

    return {
      city: location.city,
      zipCode: location.zipCode, // On peut garder le code postal (débattable)
      country: location.country,
      approximateLatitude: location.approximateLatitude || location.latitude,
      approximateLongitude: location.approximateLongitude || location.longitude,
      visibility: location.visibility,
      message: message
    };
  }

  /**
   * ========================================
   * Calcule les coordonnées approximatives (centre de la ville)
   * ========================================
   * Utilisé lors de la création d'un événement privé
   * Décale les coordonnées GPS réelles de ~2-3km
   */
  calculateApproximateCoordinates(
    latitude: number,
    longitude: number
  ): { approximateLatitude: number; approximateLongitude: number } {
    
    // Décalage aléatoire de ~0.02 degrés (environ 2km)
    const latOffset = (Math.random() - 0.5) * 0.02;
    const lngOffset = (Math.random() - 0.5) * 0.02;

    return {
      approximateLatitude: latitude + latOffset,
      approximateLongitude: longitude + lngOffset
    };
  }

  /**
   * ========================================
   * Prépare la localisation pour l'affichage sur la carte
   * ========================================
   * Retourne les coordonnées à afficher (exactes ou approximatives)
   */
  getMapCoordinates(
    location: EventLocation | MaskedEventLocation
  ): { latitude: number; longitude: number } {
    
    if ('address' in location) {
      // EventLocation complète
      return {
        latitude: location.latitude,
        longitude: location.longitude
      };
    } else {
      // MaskedEventLocation
      return {
        latitude: location.approximateLatitude || 0,
        longitude: location.approximateLongitude || 0
      };
    }
  }

  /**
   * ========================================
   * Formate l'adresse pour l'affichage
   * ========================================
   */
  formatAddressForDisplay(
    location: EventLocation | MaskedEventLocation
  ): string {
    
    if ('address' in location) {
      // Adresse complète
      return `${location.address}, ${location.zipCode} ${location.city}`;
    } else {
      // Adresse masquée
      return `${location.city}${location.zipCode ? ' (' + location.zipCode + ')' : ''}`;
    }
  }

  /**
   * ========================================
   * Vérifie si une localisation est masquée
   * ========================================
   */
  isLocationMasked(location: EventLocation | MaskedEventLocation): boolean {
    return !('address' in location);
  }
}