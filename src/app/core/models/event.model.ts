import { Timestamp } from '@angular/fire/firestore';

export interface Event {
  id?: string;                    // ID du document Firestore (auto-généré)
  title: string;                  // Titre de la soirée
  description: string;            // Description détaillée
  date: Timestamp;                // Date et heure de l'événement
  location: EventLocation;        // Localisation
  organizerId: string;            // ID de l'organisateur
  organizerName: string;          // Nom de l'organisateur (dénormalisé)
  organizerPhoto: string;         // Photo de l'organisateur (dénormalisé)
  maxParticipants: number;        // Nombre maximum de participants
  currentParticipants: number;    // Nombre actuel de participants
  participants: string[];         // Liste des IDs des participants
  category: EventCategory;        // Catégorie de l'événement
  imageUrl: string;               // URL de l'image principale
  images: string[];               // URLs des images supplémentaires
  isPrivate: boolean;             // Événement privé ou public
  requiresApproval: boolean;      // Nécessite validation pour rejoindre
  createdAt: Timestamp;           // Date de création
  updatedAt: Timestamp;           // Dernière modification
  tags: string[];                 // Tags pour recherche
}

// Localisation d'un événement
export interface EventLocation {
  address: string;                // Adresse complète
  city: string;                   // Ville
  zipCode: string;                // Code postal
  latitude: number;               // Coordonnées GPS
  longitude: number;              // Coordonnées GPS
}

// Catégories d'événements
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

// DTO pour la création d'un événement
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