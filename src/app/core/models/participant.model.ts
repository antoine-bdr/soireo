// src/app/core/models/participant.model.ts
// Modèle de données pour les participations aux événements

import { Timestamp } from '@angular/fire/firestore';

/**
 * Interface principale représentant un participant à un événement
 * Stocké dans la collection Firestore "participants"
 */
export interface Participant {
  id?: string;                    // ID du document Firestore (auto-généré)
  eventId: string;                // Référence à l'événement
  userId: string;                 // ID de l'utilisateur participant
  userName: string;               // Nom du participant (dénormalisé pour perfs)
  userEmail: string;              // Email du participant (dénormalisé)
  userPhoto?: string;             // URL photo de profil (optionnel)
  joinedAt: Timestamp;            // Date d'inscription à l'événement
  status: ParticipantStatus;      // Statut de la participation
}

/**
 * Enum représentant les différents statuts d'une participation
 */
export enum ParticipantStatus {
  PENDING = 'pending',     // En attente d'approbation (si requiresApproval = true)
  APPROVED = 'approved',   // Participation approuvée / acceptée
  REJECTED = 'rejected'    // Participation rejetée par l'organisateur
}

/**
 * DTO (Data Transfer Object) pour créer une nouvelle participation
 * Utilisé lors de l'appel à participantsService.joinEvent()
 */
export interface CreateParticipantDto {
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  status?: ParticipantStatus;     // Par défaut : APPROVED (ou PENDING si requiresApproval)
}

/**
 * Interface pour les statistiques de participation d'un événement
 * Utilisé pour afficher les compteurs et vérifier les limites
 */
export interface ParticipationStats {
  eventId: string;
  totalParticipants: number;      // Nombre total de participants
  approvedCount: number;          // Nombre de participants approuvés
  pendingCount: number;           // Nombre en attente d'approbation
  maxParticipants: number;        // Limite maximum
  isFull: boolean;                // Événement complet ?
}

/**
 * Interface pour les événements avec informations de participation enrichies
 * Utilisé dans la page "Mes Événements" pour afficher les participations
 */
export interface EventWithParticipation {
  eventId: string;
  eventTitle: string;
  eventDate: Timestamp;
  eventImageUrl: string;
  participationStatus: ParticipantStatus;
  joinedAt: Timestamp;
}