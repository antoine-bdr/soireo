// src/app/core/models/event.model.ts
// Modèle Event - VERSION CORRIGÉE
// ✅ Ajout de currentParticipants et participants[] pour conformité avec Firestore Rules

import { Timestamp } from '@angular/fire/firestore';

/**
 * Interface représentant une localisation
 * ✅ COMPLET avec tous les champs requis
 */
export interface EventLocation {
  address: string;
  city: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  country?: string;
  placeId?: string; // Google Places ID
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
 * ✅ CORRIGÉ : Ajout de currentParticipants et participants[]
 * 
 * Architecture hybride :
 * - currentParticipants et participants[] stockés dans Firestore (pour rapidité)
 * - Détails complets des participants dans collection "participants" (pour la flexibilité)
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
  currentParticipants: number; // ✅ AJOUTÉ : Nombre actuel de participants
  participants: string[];      // ✅ AJOUTÉ : Tableau des UIDs des participants
  
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

/**
 * Interface pour les statistiques d'un événement
 * Utile pour afficher des métriques sans charger tous les participants
 */
export interface EventStats {
  eventId: string;
  currentParticipants: number;
  maxParticipants: number;
  spotsRemaining: number;
  isFull: boolean;
  participationRate: number; // Pourcentage (0-100)
}