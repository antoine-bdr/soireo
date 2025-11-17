// src/app/core/services/event-permissions.service.ts
// ✅ NOUVEAU (ÉTAPE 3) : Service centralisé de gestion des permissions
// 
// RESPONSABILITÉS :
// - Calculer toutes les permissions pour un utilisateur sur un événement
// - Implémenter la matrice de permissions définie dans la documentation
// - Fournir une seule source de vérité pour les composants

import { Injectable } from '@angular/core';
import { Event, EventStatus, EventAccessType } from '../models/event.model';
import { ParticipantStatus } from '../models/participant.model';
import {
  EventPermissions,
  UserRole,
  AddressDisplayInfo
} from '../models/event-permissions.model';

@Injectable({
  providedIn: 'root'
})
export class EventPermissionsService {
  
  constructor() {}

  // ========================================
  // MÉTHODE PRINCIPALE
  // ========================================

  /**
   * Calcule TOUTES les permissions pour un utilisateur sur un événement
   * 
   * À appeler UNE SEULE FOIS au chargement de event-detail.page
   * Les permissions sont ensuite passées à tous les composants enfants
   * 
   * @param event - L'événement concerné
   * @param userId - ID de l'utilisateur courant (null si non connecté)
   * @param participantStatus - Statut de participation (undefined si non-participant)
   * @param isFriend - Est ami de l'organisateur (unused en v1)
   * @returns EventPermissions - Objet contenant toutes les permissions
   */
  calculatePermissions(
    event: Event,
    userId: string | null,
    participantStatus?: ParticipantStatus,
    isFriend?: boolean
  ): EventPermissions {
    
    // Déterminer le rôle de l'utilisateur
    const role = this.determineUserRole(event, userId, participantStatus);
    
    console.log('🔐 Calcul permissions - Role:', role, 'Status:', participantStatus);
    
    return {
      // Accès sections
      canViewEventDetail: this.canViewEventDetail(event, role),
      canViewInfo: this.canViewInfo(event, role),
      canViewFullAddress: this.canViewFullAddress(event, role),
      canViewAnnouncements: this.canViewAnnouncements(event, role),
      canViewPhotos: this.canViewPhotos(event, role),
      canViewParticipants: this.canViewParticipants(event, role),
      
      // Actions événement
      canJoinEvent: this.canJoinEvent(event, role),
      canLeaveEvent: this.canLeaveEvent(event, role),
      canEditEvent: this.canEditEvent(event, role),
      canCancelEvent: this.canCancelEvent(event, role),
      canDeleteEvent: this.canDeleteEvent(event, role),
      
      // Actions contenus
      canCreateAnnouncement: this.canCreateAnnouncement(event, role),
      canUploadPhoto: this.canUploadPhoto(event, role),
      canCheckIn: this.canCheckIn(event, role),
      canInviteFriends: this.canInviteFriends(event, role),
      canManageRequests: this.canManageRequests(event, role),
      
      // Helpers
      userRole: role,
      isOrganizer: role === UserRole.ORGANIZER,
      isApproved: role === UserRole.PARTICIPANT_APPROVED
    };
  }

  // ========================================
  // DÉTERMINATION DU RÔLE
  // ========================================

  /**
   * Détermine le rôle de l'utilisateur par rapport à l'événement
   */
  private determineUserRole(
    event: Event,
    userId: string | null,
    participantStatus?: ParticipantStatus
  ): UserRole {
    
    // Non connecté
    if (!userId) {
      return UserRole.EXTERNAL;
    }
    
    // Organisateur
    if (event.organizerId === userId) {
      return UserRole.ORGANIZER;
    }
    
    // Participant selon statut
    switch (participantStatus) {
      case ParticipantStatus.APPROVED:
        return UserRole.PARTICIPANT_APPROVED;
      case ParticipantStatus.PENDING:
        return UserRole.PARTICIPANT_PENDING;
      case ParticipantStatus.REJECTED:
        return UserRole.PARTICIPANT_REJECTED;
      default:
        return UserRole.EXTERNAL;
    }
  }

  // ========================================
  // PERMISSIONS D'ACCÈS AUX SECTIONS
  // ========================================

  /**
   * Peut voir la page de détail de l'événement
   * 
   * RÈGLES (selon Matrice Section 1) :
   * - PUBLIC : Tous les connectés (sauf non-connectés)
   * - PRIVATE : Tous sauf externes (inclut REJECTED)
   * - INVITE_ONLY : Uniquement participants/invités
   */
  private canViewEventDetail(event: Event, role: UserRole): boolean {
    // PUBLIC → Tous les connectés
    if (event.accessType === EventAccessType.PUBLIC) {
      return role !== UserRole.EXTERNAL || this.isUserAuthenticated(role);
    }
    
    // PRIVATE → Tous sauf externes (REJECTED peut voir selon décision)
    if (event.accessType === EventAccessType.PRIVATE) {
      return role !== UserRole.EXTERNAL;
    }
    
    // ✅ MODIFIÉ : INVITE_ONLY → Tous les connectés peuvent voir la page
    // (l'affichage sera conditionnel dans le template)
    if (event.accessType === EventAccessType.INVITE_ONLY) {
      return role !== UserRole.EXTERNAL; // ✅ Autoriser tous les connectés
    }
    
    return false;
  }

  /**
   * Peut voir les informations générales (Section 2)
   * Suit les mêmes règles que canViewEventDetail
   */
  private canViewInfo(event: Event, role: UserRole): boolean {
    return this.canViewEventDetail(event, role);
  }

  /**
   * Peut voir l'adresse complète (Section 3)
   * 
   * RÈGLE UNIFIÉE (Décision Produit) :
   * - TOUS les externes voient uniquement la ville
   * - APPROVED et ORGANIZER voient l'adresse complète
   */
  private canViewFullAddress(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER || 
           role === UserRole.PARTICIPANT_APPROVED;
  }

  /**
   * Peut voir la section Annonces (Section 4)
   * 
   * RÈGLE : Réservé aux APPROVED uniquement
   */
  private canViewAnnouncements(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER || 
           role === UserRole.PARTICIPANT_APPROVED;
  }

  /**
   * Peut voir la section Photos (Section 5)
   * 
   * RÈGLE : Réservé aux APPROVED uniquement
   */
  private canViewPhotos(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER || 
           role === UserRole.PARTICIPANT_APPROVED;
  }

  /**
   * Peut voir la section Participants (Section 6)
   * 
   * RÈGLE : Réservé aux APPROVED uniquement
   */
  private canViewParticipants(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER || 
           role === UserRole.PARTICIPANT_APPROVED;
  }

  // ========================================
  // PERMISSIONS D'ACTIONS SUR L'ÉVÉNEMENT
  // ========================================

  /**
   * Peut rejoindre l'événement (Section 7)
   * 
   * RÈGLES :
   * - Événement annulé → Non
   * - Événement complet → Non
   * - Organisateur → Non
   * - Déjà participant (APPROVED/PENDING) → Non
   * - INVITE_ONLY → Non (uniquement via invitation)
   * - REJECTED peut redemander (selon décision)
   * - PUBLIC/PRIVATE → Oui pour externes
   */
  private canJoinEvent(event: Event, role: UserRole): boolean {
    // Événement annulé ou complet
    if (event.status === EventStatus.CANCELLED) return false;
    if (event.currentParticipants >= event.maxParticipants) return false;
    
    // Organisateur ne peut pas rejoindre
    if (role === UserRole.ORGANIZER) return false;
    
    // Déjà participant
    if ([UserRole.PARTICIPANT_APPROVED, UserRole.PARTICIPANT_PENDING].includes(role)) {
      return false;
    }
    
    // INVITE_ONLY → Non (uniquement via invitation)
    if (event.accessType === EventAccessType.INVITE_ONLY) return false;
    
    // REJECTED peut redemander (décision Section 7)
    // PUBLIC/PRIVATE → Oui
    return true;
  }

  /**
   * Peut se désinscrire de l'événement
   * 
   * RÈGLES :
   * - Organisateur → Non (doit supprimer l'événement)
   * - APPROVED → Oui
   * - PENDING → Oui (annuler demande)
   */
  private canLeaveEvent(event: Event, role: UserRole): boolean {
    if (role === UserRole.ORGANIZER) return false;
    
    return role === UserRole.PARTICIPANT_APPROVED || 
           role === UserRole.PARTICIPANT_PENDING;
  }

  /**
   * Peut éditer l'événement (Section 9)
   * 
   * RÈGLE : Organisateur uniquement
   */
  private canEditEvent(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER;
  }

  /**
   * Peut annuler l'événement (Section 9)
   * 
   * RÈGLES :
   * - Organisateur uniquement
   * - Événement déjà annulé → Non
   */
  private canCancelEvent(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER && 
           event.status !== EventStatus.CANCELLED;
  }

  /**
   * Peut supprimer définitivement l'événement (Section 9)
   * 
   * RÈGLE : Organisateur principal uniquement
   */
  private canDeleteEvent(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER;
  }

  // ========================================
  // PERMISSIONS D'ACTIONS SUR CONTENUS
  // ========================================

  /**
   * Peut créer une annonce (Section 4)
   * 
   * RÈGLES :
   * - Organisateur uniquement
   * - Événement non annulé
   */
  private canCreateAnnouncement(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER && 
           event.status !== EventStatus.CANCELLED;
  }

  /**
   * Peut uploader des photos (Section 5)
   * 
   * RÈGLES :
   * - APPROVED ou ORGANIZER
   * - Statut ONGOING ou COMPLETED
   * - Événement non annulé
   */
  private canUploadPhoto(event: Event, role: UserRole): boolean {
    const hasRole = role === UserRole.ORGANIZER || 
                    role === UserRole.PARTICIPANT_APPROVED;
    
    const statusAllowed = event.status === EventStatus.ONGOING ||
                          event.status === EventStatus.COMPLETED;
    
    const notCancelled = event.status !== EventStatus.CANCELLED;
    
    return hasRole && statusAllowed && notCancelled;
  }

  /**
   * Peut faire un check-in (Section 8)
   * 
   * RÈGLES :
   * - APPROVED ou ORGANIZER
   * - Statut ONGOING uniquement
   * - allowCheckIn activé
   */
  private canCheckIn(event: Event, role: UserRole): boolean {
    const hasRole = role === UserRole.ORGANIZER || 
                    role === UserRole.PARTICIPANT_APPROVED;
    
    const isOngoing = event.status === EventStatus.ONGOING;
    
    const checkInAllowed = event.allowCheckIn !== false;
    
    return hasRole && isOngoing && checkInAllowed;
  }

  /**
   * Peut inviter des amis (Section 6)
   * 
   * RÈGLE : Organisateur uniquement (décision produit)
   */
  private canInviteFriends(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER && 
           event.status !== EventStatus.CANCELLED;
  }

  /**
   * Peut gérer les demandes en attente (Section 6)
   * 
   * RÈGLE : Organisateur uniquement
   */
  private canManageRequests(event: Event, role: UserRole): boolean {
    return role === UserRole.ORGANIZER;
  }

  // ========================================
  // HELPERS PUBLICS
  // ========================================

  /**
   * Génère les informations d'affichage de l'adresse
   * 
   * @param event - Événement
   * @param canSeeFullAddress - Peut voir l'adresse complète
   * @returns AddressDisplayInfo
   */
  getAddressDisplay(event: Event, canSeeFullAddress: boolean): AddressDisplayInfo {
    const location = event.location;
    
    if (canSeeFullAddress) {
      // Utilisateur APPROVED ou ORGANIZER
      const fullAddress = `${location.address}, ${location.zipCode} ${location.city}`;
      
      return {
        fullAddress: fullAddress,
        displayAddress: fullAddress,
        showMaskedMessage: false,
        maskedMessage: ''
      };
    } else {
      // Tous les autres (même PUBLIC)
      return {
        fullAddress: '',
        displayAddress: `📍 ${location.city}`,
        showMaskedMessage: true,
        maskedMessage: 'L\'adresse complète sera révélée une fois votre participation confirmée'
      };
    }
  }

  /**
   * Vérifie si un utilisateur est authentifié (helper)
   */
  private isUserAuthenticated(role: UserRole): boolean {
    return role !== UserRole.EXTERNAL;
  }

  /**
   * Vérifie si un événement est en mode lecture seule (Section 10)
   * 
   * RÈGLE : CANCELLED = Mode lecture seule
   */
  isReadOnly(event: Event): boolean {
    return event.status === EventStatus.CANCELLED;
  }
}