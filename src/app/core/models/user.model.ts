// src/app/core/models/user.model.ts
// Modèle de données pour les profils utilisateurs
// 🎯 Sprint 4 - Profil Utilisateur

import { Timestamp } from '@angular/fire/firestore';

/**
 * Interface principale représentant un utilisateur
 * Stockée dans la collection Firestore "users"
 * 
 * Structure :
 * - UID Firebase = ID du document
 * - Données d'authentification synchronisées avec Firebase Auth
 * - Données de profil personnalisées
 */
export interface User {
  // ========================================
  // IDENTIFICATION (Firebase Auth sync)
  // ========================================
  id: string;                    // UID Firebase (identique à auth.currentUser.uid)
  email: string;                 // Email de connexion
  displayName: string;           // Nom complet de l'utilisateur
  
  // ========================================
  // INFORMATIONS PERSONNELLES
  // ========================================
  firstName: string;             // Prénom
  lastName: string;              // Nom de famille
  bio?: string;                  // Biographie / Description personnelle
  phoneNumber?: string;          // Numéro de téléphone (optionnel)
  dateOfBirth?: Timestamp;       // Date de naissance (optionnel)
  
  // ========================================
  // PROFIL VISUEL
  // ========================================
  photoURL?: string;             // URL de la photo de profil (Firebase Storage)
  coverPhotoURL?: string;        // URL photo de couverture (optionnel)
  
  // ========================================
  // PRÉFÉRENCES
  // ========================================
  interests?: string[];          // Centres d'intérêt (tags)
  favoriteCategories?: string[]; // Catégories d'événements préférées
  city?: string;                 // Ville de résidence
  country?: string;              // Pays
  
  // ========================================
  // STATISTIQUES (calculées)
  // ========================================
  eventsCreatedCount: number;    // Nombre d'événements créés
  eventsJoinedCount: number;     // Nombre d'événements rejoints
  
  // ========================================
  // MÉTADONNÉES
  // ========================================
  createdAt: Timestamp;          // Date de création du compte
  updatedAt: Timestamp;          // Dernière modification du profil
  lastLoginAt?: Timestamp;       // Dernière connexion
  
  // ========================================
  // PARAMÈTRES COMPTE
  // ========================================
  isActive: boolean;             // Compte actif ou désactivé
  isEmailVerified: boolean;      // Email vérifié
  notificationsEnabled: boolean; // Notifications push activées
}

/**
 * DTO (Data Transfer Object) pour créer un profil utilisateur
 * Utilisé lors de l'inscription (authentication.service.ts)
 * 
 * Champs requis uniquement :
 * - Données Firebase Auth (id, email, displayName)
 * - Nom/Prénom extraits du displayName
 */
export interface CreateUserDto {
  id: string;                    // UID Firebase
  email: string;                 // Email
  displayName: string;           // Nom complet
  firstName: string;             // Prénom
  lastName: string;              // Nom
  photoURL?: string;             // Photo (optionnel)
  isEmailVerified?: boolean;     // Email vérifié (depuis Firebase Auth)
}

/**
 * DTO pour mettre à jour un profil utilisateur
 * Tous les champs sont optionnels (mise à jour partielle)
 * 
 * Utilisé dans profile.page.ts pour l'édition du profil
 */
export interface UpdateUserDto {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  photoURL?: string;
  coverPhotoURL?: string;
  interests?: string[];
  favoriteCategories?: string[];
  city?: string;
  country?: string;
  notificationsEnabled?: boolean;
}

/**
 * Interface pour les statistiques publiques d'un utilisateur
 * Utilisée pour afficher le profil public d'autres utilisateurs
 */
export interface UserPublicProfile {
  id: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  eventsCreatedCount: number;
  eventsJoinedCount: number;
  memberSince: Timestamp;        // createdAt
}

/**
 * Interface pour les paramètres de notification
 * Peut être étendue plus tard pour des notifications granulaires
 */
export interface UserNotificationSettings {
  enabled: boolean;
  eventReminders: boolean;
  newParticipants: boolean;
  eventUpdates: boolean;
  messages: boolean;
}