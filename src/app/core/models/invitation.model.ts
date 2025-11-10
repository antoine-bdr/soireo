// src/app/core/models/invitation.model.ts
// 📨 Modèle de données pour les invitations d'événements
// Structure Firestore : collection "invitations"

import { Timestamp } from '@angular/fire/firestore';
import { EventAccessType } from './event.model';

/**
 * 📌 Statuts d'une invitation
 */
export enum InvitationStatus {
  PENDING = 'pending',       // En attente de réponse
  ACCEPTED = 'accepted',     // Acceptée (utilisateur a rejoint)
  DECLINED = 'declined'      // Refusée par l'invité
}

/**
 * 📨 Interface principale pour une invitation d'événement
 * 
 * Structure Firestore :
 * - Collection : "invitations"
 * - Document ID : Auto-généré
 * - Index requis :
 *   1. eventId + status (asc)
 *   2. invitedUserId + status (asc)
 *   3. inviterId + eventId (asc)
 */
export interface EventInvitation {
  // ========================================
  // 🆔 IDENTIFICATION
  // ========================================
  id?: string;                        // ID Firestore du document

  // ========================================
  // 📅 ÉVÉNEMENT
  // ========================================
  eventId: string;                    // ID de l'événement
  eventTitle: string;                 // Titre (dénormalisé pour affichage)
  eventDate: Timestamp;               // Date (dénormalisé)
  eventImageUrl?: string;             // Image (dénormalisé)
  eventAccessType: EventAccessType;   // Type d'accès (pour logique client)

  // ========================================
  // 👤 ORGANISATEUR (qui invite)
  // ========================================
  inviterId: string;                  // ID de l'organisateur
  inviterName: string;                // Nom de l'organisateur
  inviterPhoto?: string;              // Photo de l'organisateur

  // ========================================
  // 👥 INVITÉ (qui reçoit l'invitation)
  // ========================================
  invitedUserId: string;              // ID de l'ami invité
  invitedUserName: string;            // Nom de l'invité
  invitedUserPhoto?: string;          // Photo de l'invité

  // ========================================
  // 📊 STATUT
  // ========================================
  status: InvitationStatus;           // Statut de l'invitation

  // ========================================
  // 📅 MÉTADONNÉES
  // ========================================
  createdAt: Timestamp;               // Date d'envoi de l'invitation
  respondedAt?: Timestamp;            // Date de réponse (accept/decline)
  expiresAt: Timestamp;               // Date d'expiration (= date événement)
}

/**
 * 📝 DTO pour créer une invitation
 */
export interface CreateInvitationDto {
  eventId: string;
  eventTitle: string;
  eventDate: Timestamp;
  eventImageUrl?: string;
  eventAccessType: EventAccessType;
  inviterId: string;
  inviterName: string;
  inviterPhoto?: string;
  invitedUserId: string;
  invitedUserName: string;
  invitedUserPhoto?: string;
  expiresAt: Timestamp;               // = eventDate
}

/**
 * 📊 Statistiques des invitations pour un événement
 * Utilisé par l'organisateur pour suivre les réponses
 */
export interface InvitationStats {
  eventId: string;
  totalInvited: number;               // Nombre total d'invitations envoyées
  pendingCount: number;               // En attente de réponse
  acceptedCount: number;              // Acceptées
  declinedCount: number;              // Refusées
  responseRate: number;               // Taux de réponse (0-100)
}

/**
 * 📋 Vue enrichie d'une invitation pour affichage
 * Combine invitation + infos événement
 */
export interface InvitationWithEvent extends EventInvitation {
  // Infos supplémentaires de l'événement (si besoin)
  eventLocation?: string;             // Ville de l'événement
  eventMaxParticipants?: number;      // Limite de participants
  eventCurrentParticipants?: number;  // Participants actuels
  isEventFull?: boolean;              // Événement complet ?
}

/**
 * ✅ Helper : Vérifie si une invitation est encore valide
 */
export function isInvitationValid(invitation: EventInvitation): boolean {
  const now = Timestamp.now();
  return invitation.status === InvitationStatus.PENDING 
    && invitation.expiresAt.toMillis() > now.toMillis();
}

/**
 * ✅ Helper : Vérifie si une invitation est expirée
 */
export function isInvitationExpired(invitation: EventInvitation): boolean {
  const now = Timestamp.now();
  return invitation.expiresAt.toMillis() <= now.toMillis();
}

/**
 * ✅ Helper : Calcule le taux de réponse
 */
export function calculateResponseRate(stats: InvitationStats): number {
  if (stats.totalInvited === 0) return 0;
  const responded = stats.acceptedCount + stats.declinedCount;
  return Math.round((responded / stats.totalInvited) * 100);
}