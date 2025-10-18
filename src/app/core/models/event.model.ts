// src/app/core/models/event.model.ts
// Modèle Event - VERSION CORRIGÉE avec zipCode

import { Timestamp } from '@angular/fire/firestore';

/**
 * Interface représentant une localisation
 * ✅ FIX : Ajout de zipCode
 */
export interface EventLocation {
  address: string;
  city: string;
  zipCode: string; // ✅ AJOUTÉ
  latitude?: number;
  longitude?: number;
  country?: string;
}

/**
 * Énumération des catégories d'événements
 */
export enum EventCategory {
  PARTY = 'party',
  CONCERT = 'concert',
  FESTIVAL = 'festival',
  BAR = 'bar',
  CLUB = 'club',
  OUTDOOR = 'outdoor',
  PRIVATE = 'private',
  OTHER = 'other'
}

/**
 * Interface Event principale
 * ✅ Sans currentParticipants et participants[]
 * Ces données viennent de la collection "participants"
 */
export interface Event {
  id?: string;
  
  // Informations de base
  title: string;
  description: string;
  date: Timestamp;
  location: EventLocation;
  
  // Organisateur
  organizerId: string;
  organizerName: string;
  organizerPhoto?: string;
  
  // Participants
  maxParticipants: number;
  // ✅ PAS de currentParticipants (calculé via ParticipantsService)
  // ✅ PAS de participants[] (récupéré via ParticipantsService)
  
  // Catégorisation
  category: EventCategory;
  tags?: string[];
  
  // Médias
  imageUrl: string;
  images?: string[];
  
  // Configuration
  isPrivate: boolean;
  requiresApproval: boolean;
  
  // Métadonnées
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * DTO pour la création d'un événement
 */
export interface CreateEventDto {
  title: string;
  description: string;
  date: Date;
  location: EventLocation;
  maxParticipants: number;
  category: EventCategory;
  imageUrl?: string;
  isPrivate: boolean;
  requiresApproval: boolean;
  tags?: string[];
}

/**
 * DTO pour la mise à jour d'un événement
 */
export interface UpdateEventDto {
  title?: string;
  description?: string;
  date?: Date;
  location?: EventLocation;
  maxParticipants?: number;
  category?: EventCategory;
  imageUrl?: string;
  isPrivate?: boolean;
  requiresApproval?: boolean;
  tags?: string[];
}