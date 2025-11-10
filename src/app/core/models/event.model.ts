// src/app/core/models/event.model.ts
// Modèle Event - VERSION AMÉLIORÉE avec Statuts
// ✅ Ajout des statuts, check-in, et fonctionnalités v1

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

export enum AddressVisibility {
  PUBLIC = 'public',
  CITY_ONLY = 'city',
  PARTICIPANTS_ONLY = 'participants'
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
 * Interface Event principale - VERSION AMÉLIORÉE
 */
export interface Event {
  id?: string;
  
  // Informations de base
  title: string;
  description: string;
  date: Timestamp;
  startTime?: Timestamp;      // ✅ NOUVEAU : Heure de début précise
  endTime?: Timestamp;        // ✅ NOUVEAU : Heure de fin
  status?: EventStatus;       // ✅ NOUVEAU : Statut de l'événement
  
  location: EventLocation;
  
  // Organisateur
  organizerId: string;
  organizerName: string;
  organizerPhoto?: string;
  coOrganizers?: string[];    // ✅ NOUVEAU : Co-organisateurs
  
  // Participants
  maxParticipants: number;
  currentParticipants: number;
  participants: string[];
  actualAttendees?: string[];  // ✅ NOUVEAU : Présences réelles (check-in)
  
  // Catégorisation
  category: EventCategory;
  tags?: string[];
  
  // Médias
  imageUrl: string;
  images?: string[];
  eventPhotos?: EventPhoto[] | string[];      // ✅ NOUVEAU : Photos pendant/après l'événement
  
  // Configuration
  accessType: EventAccessType;     // ✅ NOUVEAU : Type d'accès (remplace isPrivate)
  requiresApproval: boolean;
  allowSharing?: boolean;          // ✅ NOUVEAU : Si participants peuvent partager
  allowCheckIn?: boolean;          // ✅ NOUVEAU : Active le check-in
  checkInQRCode?: string;          // ✅ NOUVEAU : QR code pour check-in
  
  // ⚠️ DEPRECATED - Conservé pour compatibilité, sera supprimé
  isPrivate?: boolean;             // @deprecated Utiliser accessType à la place
  
  // Métadonnées
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastStatusUpdate?: Timestamp; // ✅ NOUVEAU : Dernier changement de statut
}

/**
 * DTO pour la création d'un événement
 */
export interface CreateEventDto {
  title: string;
  description: string;
  date: Date;
  startTime?: Date;           // ✅ NOUVEAU
  endTime?: Date;             // ✅ NOUVEAU
  location: EventLocation;
  maxParticipants: number;
  category: EventCategory;
  imageUrl?: string;
  accessType: EventAccessType;    // ✅ NOUVEAU : Type d'accès
  requiresApproval: boolean;
  allowSharing?: boolean;         // ✅ NOUVEAU : Si participants peuvent partager
  tags?: string[];
  coOrganizers?: string[];    // ✅ NOUVEAU
  allowCheckIn?: boolean;     // ✅ NOUVEAU
}

/**
 * Interface pour les annonces/posts sur l'événement
 * ✅ NOUVEAU : Pour la v1
 */
export interface EventAnnouncement {
  id?: string;
  eventId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  message: string;
  images?: string[];
  timestamp: Timestamp;
  isPinned?: boolean;
  type: 'info' | 'update' | 'alert' | 'photo';
}

/**
 * Interface pour le check-in
 * ✅ NOUVEAU : Pour la v1
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
  actualAttendanceRate?: number; // ✅ NOUVEAU : Taux de présence réelle
  checkInCount?: number;         // ✅ NOUVEAU : Nombre de check-ins
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
 * ✅ NOUVEAU : Pour tracker qui a uploadé chaque photo
 */
export interface EventPhoto {
  url: string;              // URL de la photo
  uploadedBy: string;       // userId de l'auteur
  uploadedByName: string;   // Nom de l'auteur
  uploadedAt: Timestamp;    // Date d'upload
}