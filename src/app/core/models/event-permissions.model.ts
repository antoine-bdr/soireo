// src/app/core/models/event-permissions.model.ts
// ✅ NOUVEAU (ÉTAPE 2) : Types pour la gestion centralisée des permissions

import { ParticipantStatus } from './participant.model';

/**
 * ========================================
 * RÔLES UTILISATEUR
 * ========================================
 * 
 * Détermine le rôle d'un utilisateur par rapport à un événement
 * Utilisé pour calculer les permissions appropriées
 */
export enum UserRole {
  ORGANIZER = 'organizer',                    // Créateur de l'événement
  PARTICIPANT_APPROVED = 'approved',          // Participant confirmé
  PARTICIPANT_PENDING = 'pending',            // En attente d'approbation
  PARTICIPANT_REJECTED = 'rejected',          // Participation refusée
  FRIEND_OF_ORGANIZER = 'friend',            // Ami de l'organisateur (unused en v1)
  EXTERNAL = 'external'                       // Utilisateur externe/non-participant
}

/**
 * ========================================
 * PERMISSIONS ÉVÉNEMENT
 * ========================================
 * 
 * Interface centralisée contenant TOUTES les permissions
 * Calculée une seule fois au chargement de la page event-detail
 * Propagée à tous les composants enfants (segments)
 * 
 * Avantages :
 * - Cohérence : Une seule source de vérité
 * - Performance : Calcul unique au lieu de multiples vérifications
 * - Maintenabilité : Logique centralisée dans EventPermissionsService
 */
export interface EventPermissions {
  // ========================================
  // ACCÈS AUX SECTIONS
  // ========================================
  
  /** Peut voir la page de détail de l'événement */
  canViewEventDetail: boolean;
  
  /** Peut voir les informations générales (titre, description, date) */
  canViewInfo: boolean;
  
  /** Peut voir l'adresse complète (sinon uniquement ville) */
  canViewFullAddress: boolean;
  
  /** Peut voir la section Annonces */
  canViewAnnouncements: boolean;
  
  /** Peut voir la section Photos */
  canViewPhotos: boolean;
  
  /** Peut voir la section Participants */
  canViewParticipants: boolean;

  canManageParticipants: boolean;
  
  // ========================================
  // ACTIONS SUR L'ÉVÉNEMENT
  // ========================================
  
  /** Peut demander à rejoindre l'événement (bouton "Participer") */
  canJoinEvent: boolean;
  
  /** Peut se désinscrire de l'événement */
  canLeaveEvent: boolean;
  
  /** Peut éditer les informations de l'événement */
  canEditEvent: boolean;
  
  /** Peut annuler l'événement */
  canCancelEvent: boolean;
  
  /** Peut supprimer définitivement l'événement */
  canDeleteEvent: boolean;
  
  // ========================================
  // ACTIONS SUR CONTENUS
  // ========================================
  
  /** Peut créer une annonce */
  canCreateAnnouncement: boolean;
  
  /** Peut uploader des photos */
  canUploadPhoto: boolean;
  
  /** Peut faire un check-in */
  canCheckIn: boolean;
  
  /** Peut inviter des amis */
  canInviteFriends: boolean;
  
  /** Peut gérer les demandes en attente (approve/reject) */
  canManageRequests: boolean;
  
  // ========================================
  // HELPERS UI
  // ========================================
  
  /** Rôle de l'utilisateur (pour affichages conditionnels) */
  userRole: UserRole;
  
  /** Raccourci : Est organisateur */
  isOrganizer: boolean;
  
  /** Raccourci : Est participant approuvé */
  isApproved: boolean;
}

/**
 * ========================================
 * INFORMATIONS D'AFFICHAGE ADRESSE
 * ========================================
 * 
 * Encapsule toutes les données nécessaires pour afficher l'adresse
 * selon les permissions de l'utilisateur
 */
export interface AddressDisplayInfo {
  /** Adresse complète (vide si masquée) */
  fullAddress: string;
  
  /** Adresse à afficher (soit complète, soit ville uniquement) */
  displayAddress: string;
  
  /** Doit-on afficher le message d'adresse masquée ? */
  showMaskedMessage: boolean;
  
  /** Message explicatif si adresse masquée */
  maskedMessage: string;
}

/**
 * ========================================
 * STATUT DE PARTICIPATION UTILISATEUR
 * ========================================
 * 
 * Résumé du statut de participation pour l'utilisateur courant
 * Utilisé pour afficher les badges et messages appropriés
 */
export interface UserParticipationInfo {
  /** Statut de participation (ou null si non-participant) */
  status: ParticipantStatus | null;
  
  /** Est organisateur de cet événement */
  isOrganizer: boolean;
  
  /** Est participant (quel que soit le statut) */
  isParticipant: boolean;
  
  /** Est participant approuvé */
  isApproved: boolean;
  
  /** Est en attente d'approbation */
  isPending: boolean;
  
  /** A été refusé */
  isRejected: boolean;
  
  /** A une invitation en attente pour cet événement */
  hasInvitation: boolean;
}

/**
 * ========================================
 * OPTIONS D'ACTION DISPONIBLES
 * ========================================
 * 
 * Liste des actions disponibles selon le statut de l'événement
 * Utilisé pour afficher dynamiquement les boutons d'action
 */
export interface AvailableActions {
  /** Actions principales (boutons primaires) */
  primary: ActionButton[];
  
  /** Actions secondaires (menu options) */
  secondary: ActionButton[];
}

/**
 * Représente un bouton d'action avec ses propriétés
 */
export interface ActionButton {
  /** ID unique de l'action */
  id: string;
  
  /** Label affiché sur le bouton */
  label: string;
  
  /** Icône Ionicons */
  icon: string;
  
  /** Couleur du bouton */
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'medium';
  
  /** Type de bouton */
  fill?: 'solid' | 'outline' | 'clear';
  
  /** Est désactivé */
  disabled?: boolean;
  
  /** Message de désactivation (tooltip) */
  disabledReason?: string;
}