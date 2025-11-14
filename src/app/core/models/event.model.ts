// src/app/core/models/event.model.ts
// Modèle Event - VERSION REFACTORÉE (ÉTAPE 1)
// ✅ AddressVisibility simplifié
// ✅ coOrganizers retiré (v2)
// ✅ Champs d'annulation ajoutés

import { Timestamp } from '@angular/fire/firestore';

/**
 * Statuts de l'événement
 */
export enum EventStatus {
  UPCOMING = 'upcoming',    // À venir
  ONGOING = 'ongoing',      // En cours
  COMPLETED = 'completed',  // Terminé
  CANCELLED = 'cancelled'   // Annulé
}

/**
 * ✅ Types d'accès à l'événement
 * Détermine qui peut voir et rejoindre l'événement
 */
export enum EventAccessType {
  PUBLIC = 'public',              // Visible par tous, ouvert aux demandes
  PRIVATE = 'private',            // Visible par amis des participants, accepte demandes + invitations
  INVITE_ONLY = 'invite_only'    // Invisible dans les listes, uniquement sur invitation
}

/**
 * Interface représentant une localisation
 */
export interface EventLocation {
  address: string;
  city: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  country?: string;
  placeId?: string;
  
  visibility: AddressVisibility;
  approximateLatitude?: number;
  approximateLongitude?: number;
}

/**
 * ✅ REFACTORÉ (ÉTAPE 1) : Visibilité d'adresse simplifiée
 * 
 * LOGIQUE UNIFIÉE :
 * - Par défaut : Ville uniquement visible pour tous les externes
 * - Si PARTICIPANTS_ONLY : Adresse complète visible uniquement pour APPROVED
 * 
 * MIGRATION :
 * - Les valeurs 'public' et 'city' des événements existants seront migrées
 * - Script de migration disponible dans /core/migrations/
 * 
 * DÉCISION PRODUIT (Section 3) :
 * "Je souhaite que pour toutes les events, uniquement le nom de la ville 
 * soit affiché pour un utilisateur extérieur à la soirée. Même en public. 
 * L'adresse sera ensuite divulguée lorsque l'utilisateur est accepté."
 */
export enum AddressVisibility {
  PARTICIPANTS_ONLY = 'participants'  // ✅ Seul mode supporté
}

/**
 * Catégories d'événements
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
 * Interface Event principale - VERSION REFACTORÉE
 */
export interface Event {
  id?: string;
  
  // Informations de base
  title: string;
  description: string;
  date: Timestamp;
  startTime?: Timestamp;      // ✅ Heure de début précise
  endTime?: Timestamp;        // ✅ Heure de fin
  status?: EventStatus;       // ✅ Statut de l'événement
  
  location: EventLocation;
  
  // Organisateur
  organizerId: string;
  organizerName: string;
  organizerPhoto?: string;
  
  // ❌ RETIRÉ POUR v1 (ÉTAPE 1) - À réimplémenter en v2
  // coOrganizers?: string[];    // Co-organisateurs
  
  // Participants
  maxParticipants: number;
  currentParticipants: number;
  participants: string[];
  actualAttendees?: string[];  // ✅ Présences réelles (check-in)
  
  // Catégorisation
  category: EventCategory;
  tags?: string[];
  
  // Médias
  imageUrl: string;
  images?: string[];
  eventPhotos?: EventPhoto[] | string[];      // ✅ Photos pendant/après l'événement
  
  // Configuration
  accessType: EventAccessType;     // ✅ Type d'accès (remplace isPrivate)
  requiresApproval: boolean;
  allowSharing?: boolean;          // ✅ Si participants peuvent partager
  allowCheckIn?: boolean;          // ✅ Active le check-in
  checkInQRCode?: string;          // ✅ QR code pour check-in
  
  // ⚠️ DEPRECATED - Conservé pour compatibilité, sera supprimé
  isPrivate?: boolean;             // @deprecated Utiliser accessType à la place
  
  // ✅ NOUVEAU (ÉTAPE 1) : Champs pour événements annulés
  cancellationReason?: string;     // Raison de l'annulation
  cancelledBy?: string;            // User ID qui a annulé
  cancelledAt?: Timestamp;         // Date d'annulation
  
  // Métadonnées
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastStatusUpdate?: Timestamp;    // ✅ Dernier changement de statut
}

/**
 * DTO pour la création d'un événement
 */
export interface CreateEventDto {
  title: string;
  description: string;
  date: Date;
  startTime?: Date;
  endTime?: Date;
  location: EventLocation;
  maxParticipants: number;
  category: EventCategory;
  imageUrl?: string;
  accessType: EventAccessType;
  requiresApproval: boolean;
  allowSharing?: boolean;
  tags?: string[];
  
  // ❌ RETIRÉ POUR v1 (ÉTAPE 1)
  // coOrganizers?: string[];
  
  allowCheckIn?: boolean;
}

/**
 * Interface pour les annonces/posts sur l'événement
 * ✅ Pour la v1
 */
export interface EventAnnouncement {
  id?: string;
  eventId: string;
  authorId: string;
  authorName: string;
  message: string;
  images?: string[];
  timestamp: Timestamp;
  type: 'info' | 'important' | 'reminder' | 'live' | 'thanks';
  isPinned: boolean;
}

/**
 * Interface pour le check-in
 * ✅ Pour la v1
 */
export interface EventCheckIn {
  id?: string;
  eventId: string;
  userId: string;
  userName: string;
  checkInTime: Timestamp;
  method: 'manual' | 'qr' | 'proximity';
}

/**
 * Statistiques d'un événement
 */
export interface EventStats {
  eventId: string;
  currentParticipants: number;
  maxParticipants: number;
  spotsRemaining: number;
  isFull: boolean;
  participationRate: number;
  actualAttendanceRate?: number; // ✅ Taux de présence réelle
  checkInCount?: number;         // ✅ Nombre de check-ins
}

/**
 * Interface pour une localisation masquée
 * Utilisée quand l'utilisateur n'a pas le droit de voir l'adresse complète
 */
export interface MaskedEventLocation {
  city: string;
  zipCode?: string;
  country?: string;
  approximateLatitude: number;
  approximateLongitude: number;
  visibility: AddressVisibility;
  message: string;  // Message expliquant pourquoi l'adresse est masquée
}

/**
 * Interface pour un Event avec adresse conditionnelle
 * Utilisée dans la page de détail pour gérer l'affichage de l'adresse
 */
export interface EventWithConditionalLocation extends Omit<Event, "location"> {
  location: EventLocation | MaskedEventLocation;
  canSeeFullAddress: boolean;  // Indique si l'utilisateur peut voir l'adresse complète
}

/**
 * Interface pour une photo d'événement avec métadonnées
 * ✅ Pour tracker qui a uploadé chaque photo
 */
export interface EventPhoto {
  id?: string;
  eventId: string;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
}