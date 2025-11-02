// src/app/core/models/friend.model.ts
// 👥 Modèle de données pour les relations d'amitié
// Structure Firestore : collection "friendships"

import { Timestamp } from '@angular/fire/firestore';

/**
 * 📌 Statuts possibles d'une relation d'amitié
 */
export enum FriendshipStatus {
  PENDING = 'pending',     // Demande envoyée, en attente d'acceptation
  ACCEPTED = 'accepted',   // Amis confirmés
  BLOCKED = 'blocked'      // Utilisateur bloqué
}

/**
 * 👥 Interface principale pour une relation d'amitié
 * 
 * Structure Firestore :
 * - Collection : "friendships"
 * - Document ID : Auto-généré par Firestore
 * - Index composés requis :
 *   1. senderId + status
 *   2. receiverId + status
 *   3. senderId + receiverId (unicité)
 */
export interface Friendship {
  // ========================================
  // 🆔 IDENTIFICATION
  // ========================================
  id?: string;                      // ID Firestore du document
  
  // ========================================
  // 👥 PARTICIPANTS
  // ========================================
  senderId: string;                 // UID de l'utilisateur qui envoie la demande
  receiverId: string;               // UID de l'utilisateur qui reçoit la demande
  
  // Données dénormalisées pour affichage rapide (évite les jointures)
  senderDisplayName: string;        // Nom complet de l'expéditeur
  senderPhotoURL?: string;          // Photo de profil de l'expéditeur
  receiverDisplayName: string;      // Nom complet du destinataire
  receiverPhotoURL?: string;        // Photo de profil du destinataire
  
  // ========================================
  // 📊 STATUT
  // ========================================
  status: FriendshipStatus;         // État actuel de la relation
  
  // ========================================
  // 📅 MÉTADONNÉES
  // ========================================
  createdAt: Timestamp;             // Date d'envoi de la demande
  acceptedAt?: Timestamp;           // Date d'acceptation (si status = ACCEPTED)
  updatedAt: Timestamp;             // Dernière modification
}

/**
 * 📝 DTO pour créer une nouvelle demande d'ami
 */
export interface CreateFriendshipDto {
  senderId: string;
  receiverId: string;
  senderDisplayName: string;
  senderPhotoURL?: string;
  receiverDisplayName: string;
  receiverPhotoURL?: string;
}

/**
 * 👤 Interface pour afficher un ami dans une liste
 * Vue simplifiée depuis le point de vue de l'utilisateur courant
 */
export interface FriendListItem {
  friendshipId: string;             // ID du document Friendship
  userId: string;                   // UID de l'ami (senderId OU receiverId selon contexte)
  displayName: string;              // Nom de l'ami
  photoURL?: string;                // Photo de l'ami
  status: FriendshipStatus;         // Statut de la relation
  isPending: boolean;               // true si demande en attente
  isSender: boolean;                // true si l'utilisateur courant a envoyé la demande
  friendSince?: Date;               // Date depuis laquelle ils sont amis
}

/**
 * 🔍 Interface pour les résultats de recherche d'utilisateurs
 * Utilisée dans la page friend-search
 */
export interface UserSearchResult {
  userId: string;                   // UID de l'utilisateur
  displayName: string;              // Nom complet
  photoURL?: string;                // Photo de profil
  bio?: string;                     // Biographie
  city?: string;                    // Ville
  
  // États relationnels (calculés côté client)
  friendshipStatus?: FriendshipStatus; // Statut de la relation si elle existe
  friendshipId?: string;            // ID du document Friendship si existe
  isFriend: boolean;                // true si déjà ami
  isPendingRequest: boolean;        // true si demande en attente
  isSentByMe: boolean;              // true si j'ai envoyé la demande
}

/**
 * 📊 Interface pour les statistiques d'amitié
 */
export interface FriendshipStats {
  totalFriends: number;             // Nombre total d'amis acceptés
  pendingReceived: number;          // Demandes reçues en attente
  pendingSent: number;              // Demandes envoyées en attente
  blockedUsers: number;             // Utilisateurs bloqués
}

/**
 * ✅ Helper : Détermine si deux utilisateurs sont amis
 */
export function areFriends(friendship: Friendship | null): boolean {
  return friendship?.status === FriendshipStatus.ACCEPTED;
}

/**
 * ✅ Helper : Détermine si une demande est en attente
 */
export function isPending(friendship: Friendship | null): boolean {
  return friendship?.status === FriendshipStatus.PENDING;
}

/**
 * ✅ Helper : Extrait l'ID de l'ami depuis une Friendship
 * @param friendship Relation d'amitié
 * @param currentUserId UID de l'utilisateur courant
 * @returns UID de l'ami (l'autre personne dans la relation)
 */
export function getFriendId(friendship: Friendship, currentUserId: string): string {
  return friendship.senderId === currentUserId 
    ? friendship.receiverId 
    : friendship.senderId;
}

/**
 * ✅ Helper : Extrait les données de l'ami depuis une Friendship
 * @param friendship Relation d'amitié
 * @param currentUserId UID de l'utilisateur courant
 * @returns Objet avec displayName et photoURL de l'ami
 */
export function getFriendData(friendship: Friendship, currentUserId: string): {
  displayName: string;
  photoURL?: string;
} {
  return friendship.senderId === currentUserId
    ? {
        displayName: friendship.receiverDisplayName,
        photoURL: friendship.receiverPhotoURL
      }
    : {
        displayName: friendship.senderDisplayName,
        photoURL: friendship.senderPhotoURL
      };
}