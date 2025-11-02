// src/app/core/models/user.model.ts
// Modèle de données pour les profils utilisateurs
// 🎯 Sprint 4 - Profil Utilisateur ENRICHI

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
  bio?: string;                  // Biographie / Description personnelle (max 500 char)
  phoneNumber?: string;          // Numéro de téléphone (optionnel)
  dateOfBirth?: Timestamp;       // Date de naissance (NOUVEAU - obligatoire pour âge)
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say'; // Genre (NOUVEAU)
  
  // ========================================
  // PROFIL VISUEL (ENRICHI)
  // ========================================
  photoURL?: string;             // URL de la photo de profil principale (Firebase Storage)
  coverPhotoURL?: string;        // URL photo de couverture (optionnel)
  profilePhotos?: string[];      // NOUVEAU : Galerie de photos (max 5 photos)
  
  // ========================================
  // PRÉFÉRENCES (ENRICHI)
  // ========================================
  interests?: string[];          // NOUVEAU : Centres d'intérêt (tags) - max 10
  musicStyles?: string[];        // NOUVEAU : Styles de musique préférés - max 5
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
  dateOfBirth?: Timestamp;       // NOUVEAU : Date de naissance (optionnel à l'inscription)
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
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  photoURL?: string;
  coverPhotoURL?: string;
  profilePhotos?: string[];      // NOUVEAU : Galerie photos
  interests?: string[];          // NOUVEAU : Centres d'intérêt
  musicStyles?: string[];        // NOUVEAU : Styles de musique
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
  profilePhotos?: string[];      // NOUVEAU : Galerie visible publiquement
  bio?: string;
  age?: number;                  // NOUVEAU : Âge calculé
  gender?: string;               // NOUVEAU
  interests?: string[];          // NOUVEAU : Centres d'intérêt visibles
  musicStyles?: string[];        // NOUVEAU : Styles de musique visibles
  city?: string;
  eventsCreatedCount: number;
  eventsJoinedCount: number;
  memberSince: Timestamp;        // createdAt
  badges?: UserBadge[];          // NOUVEAU : Badges visibles
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

// ========================================
// NOUVELLES INTERFACES POUR LE PROFIL ENRICHI
// ========================================

/**
 * Types de badges disponibles
 */
export enum BadgeType {
  EMAIL_VERIFIED = 'email_verified',
  PROFILE_COMPLETE = 'profile_complete',
  NEW_MEMBER = 'new_member',
  ACTIVE_ORGANIZER = 'active_organizer',
  SUPER_ORGANIZER = 'super_organizer',
  ACTIVE_PARTICIPANT = 'active_participant',
  SUPER_PARTICIPANT = 'super_participant',
  EARLY_ADOPTER = 'early_adopter',
  VERIFIED_PROFILE = 'verified_profile' // Pour validation manuelle future
}

/**
 * Interface représentant un badge utilisateur
 */
export interface UserBadge {
  type: BadgeType;
  label: string;              // Nom affiché (ex: "Email vérifié")
  icon: string;               // Nom de l'icône Ionic
  color: string;              // Couleur du badge (ex: "success", "primary")
  description: string;        // Description du badge
  earnedAt?: Timestamp;       // Date d'obtention (optionnel)
}

/**
 * Interface pour le statut de complétude du profil
 * Utilisée pour la barre de progression
 */
export interface ProfileCompletionStatus {
  percentage: number;         // Pourcentage de complétude (0-100)
  completedFields: string[];  // Champs complétés
  missingFields: string[];    // Champs manquants
  totalFields: number;        // Nombre total de champs
  completedCount: number;     // Nombre de champs complétés
}

/**
 * Interface pour les champs de complétude du profil
 * Définit quels champs comptent pour la progression
 */
export interface ProfileCompletionFields {
  photoURL: boolean;          // Photo de profil
  bio: boolean;               // Biographie
  dateOfBirth: boolean;       // Date de naissance / Âge
  phoneNumber: boolean;       // Téléphone
  city: boolean;              // Ville
  interests: boolean;         // Au moins 3 centres d'intérêt
  musicStyles: boolean;       // Au moins 2 styles de musique
  profilePhotos: boolean;     // Au moins 3 photos dans la galerie (sur 6 max)
}

/**
 * Constantes pour les centres d'intérêt suggérés
 */
export const SUGGESTED_INTERESTS = [
  '🎉 Fêtes',
  '🍹 Bars',
  '🎵 Concerts',
  '🎭 Spectacles',
  '🏃 Sport',
  '🎮 Gaming',
  '🍕 Cuisine',
  '✈️ Voyages',
  '📚 Lecture',
  '🎨 Art',
  '🎬 Cinéma',
  '📸 Photo',
  '🎤 Karaoké',
  '💃 Danse',
  '🍷 Dégustation',
  '🎲 Jeux de société',
  '🏖️ Plage',
  '⛰️ Montagne',
  '🎪 Festivals',
  '🌃 Soirées urbaines'
];

/**
 * Constantes pour les styles de musique
 * L'utilisateur peut en sélectionner jusqu'à 5
 */
export const MUSIC_STYLES = [
  '🎵 Pop',
  '🎸 Rock',
  '🎤 Hip-Hop',
  '🎹 Electro',
  '🎺 Jazz',
  '🎻 Classique',
  '🪕 Country',
  '🥁 Reggae',
  '🎧 Techno',
  '🎼 House',
  '🎶 R&B',
  '🎙️ Rap',
  '🎸 Metal',
  '🎵 Soul',
  '🎹 Disco',
  '🎺 Blues',
  '🎻 Folk',
  '🪕 Indie',
  '🎧 Dubstep',
  '🎼 Trance',
  '🥁 Drum & Bass',
  '🎶 Funk',
  '🎤 K-Pop',
  '🎵 Latino'
];

/**
 * Helper : Calcule l'âge à partir de la date de naissance
 */
export function calculateAge(dateOfBirth: Timestamp | Date): number {
  const birthDate = dateOfBirth instanceof Timestamp 
    ? dateOfBirth.toDate() 
    : dateOfBirth;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}