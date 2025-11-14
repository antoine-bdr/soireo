// src/app/core/services/invitations.service.ts
// 📨 Service de gestion des invitations d'événements
// Gère l'envoi, l'acceptation, le refus et le suivi des invitations

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  writeBatch
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import { 
  EventInvitation, 
  InvitationStatus, 
  CreateInvitationDto,
  InvitationStats,
  isInvitationExpired
} from '../models/invitation.model';
import { Event, EventAccessType } from '../models/event.model';
import { NotificationsService } from './notifications.service';
import { NotificationType, createNotificationWithDefaults } from '../models/notification.model';
import { AuthenticationService } from './authentication.service';
import { arrayUnion, increment } from 'firebase/firestore';
import { ParticipantStatus } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class InvitationsService {
  private readonly firestore = inject(Firestore);
  private readonly notificationsService = inject(NotificationsService);
  private readonly authService = inject(AuthenticationService);
  
  private readonly invitationsCollection = 'invitations';

  // ========================================
  // 📨 ENVOI D'INVITATIONS
  // ========================================

  /**
   * Envoie des invitations à plusieurs amis pour un événement
   * 
   * @param eventId - ID de l'événement
   * @param event - Données de l'événement (pour notifications)
   * @param friendIds - Liste des IDs des amis à inviter
   * @param friendsData - Map contenant les infos des amis (nom, photo)
   * @returns Promise<number> - Nombre d'invitations envoyées avec succès
   */
  async sendInvitations(
    eventId: string,
    event: Event,
    friendIds: string[],
    friendsData: Map<string, { name: string; photo?: string }>
  ): Promise<number> {
    console.log(`📨 Envoi de ${friendIds.length} invitations pour l'événement ${eventId}`);

    const batch = writeBatch(this.firestore);
    const invitationsRef = collection(this.firestore, this.invitationsCollection);
    let successCount = 0;

    try {
      const currentUserId = this.authService.getCurrentUserId();
      if (!currentUserId) {
        throw new Error('Utilisateur non connecté');
      }

      // Vérifier les invitations existantes pour éviter les doublons
      const existingInvitations = await this.getExistingInvitations(eventId, friendIds);

      for (const friendId of friendIds) {
        // ✅ Si une invitation existe déjà (quel que soit son statut), la supprimer
        if (existingInvitations.has(friendId)) {
          const oldInvitationId = existingInvitations.get(friendId)!;
          const oldInvitationRef = doc(this.firestore, this.invitationsCollection, oldInvitationId);
          batch.delete(oldInvitationRef);
          console.log(`🗑️ Ancienne invitation supprimée pour ${friendId}`);
        }

        const friendData = friendsData.get(friendId);
        if (!friendData) {
          console.warn(`⚠️ Données manquantes pour l'ami ${friendId}`);
          continue;
        }


        // Créer l'invitation
        const invitationDto: CreateInvitationDto = {
          eventId,
          eventTitle: event.title,
          eventDate: event.date,
          eventImageUrl: event.imageUrl,
          eventAccessType: event.accessType,
          inviterId: currentUserId,
          inviterName: event.organizerName,
          inviterPhoto: event.organizerPhoto,
          invitedUserId: friendId,
          invitedUserName: friendData.name,
          invitedUserPhoto: friendData.photo,
          expiresAt: event.date // Expire à la date de l'événement
        };

        const newInvitationRef = doc(invitationsRef);
        const invitation: EventInvitation = {
          ...invitationDto,
          status: InvitationStatus.PENDING,
          createdAt: Timestamp.now()
        };

        batch.set(newInvitationRef, invitation);

        // Créer la notification (sera envoyée après le batch)
        const notification = createNotificationWithDefaults(
          NotificationType.EVENT_INVITATION,
          friendId,
          `${event.organizerName} vous invite à "${event.title}" le ${event.date.toDate().toLocaleDateString('fr-FR')}`,
          {
            relatedEntityId: eventId,
            relatedEntityType: 'event',
            actionUrl: `/tabs/events/${eventId}`,
            senderUserId: currentUserId,
            senderDisplayName: event.organizerName,
            senderPhotoURL: event.organizerPhoto
          }
        );

        // Envoyer la notification (fire and forget)
        this.notificationsService.createNotification(notification).catch(err => 
          console.error('❌ Erreur envoi notification invitation:', err)
        );

        successCount++;
      }

      // Commit du batch
      await batch.commit();
      console.log(`✅ ${successCount} invitations envoyées avec succès`);
      
      return successCount;
    } catch (error) {
      console.error('❌ Erreur envoi invitations:', error);
      throw error;
    }
  }

  /**
   * Vérifie les invitations existantes pour éviter les doublons
   * Retourne un Set des IDs des amis déjà invités avec status PENDING
   */
  private async getExistingInvitations(
    eventId: string,
    friendIds: string[]
  ): Promise<Map<string, string>> {  // ✅ Retourne Map<userId, invitationId>
    const invitationsMap = new Map<string, string>();
  
    try {
      const invitationsRef = collection(this.firestore, this.invitationsCollection);
      const q = query(
        invitationsRef,
        where('eventId', '==', eventId),
        where('invitedUserId', 'in', friendIds.slice(0, 10))
        // ✅ Supprimé le filtre sur status pour récupérer TOUS les statuts
      );
  
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(doc => {
        const invitation = doc.data() as EventInvitation;
        invitationsMap.set(invitation.invitedUserId, doc.id);
      });
    } catch (error) {
      console.error('❌ Erreur vérification invitations existantes:', error);
    }
  
    return invitationsMap;
  }

  // ========================================
  // 📋 RÉCUPÉRATION D'INVITATIONS
  // ========================================

  /**
   * Récupère toutes les invitations pour un événement (temps réel)
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<EventInvitation[]> - Liste des invitations
   */
  getEventInvitations(eventId: string): Observable<EventInvitation[]> {
    return new Observable(observer => {
      const invitationsRef = collection(this.firestore, this.invitationsCollection);
      const q = query(
        invitationsRef,
        where('eventId', '==', eventId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const invitations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as EventInvitation));

          observer.next(invitations);
        },
        (error) => {
          console.error('❌ Erreur récupération invitations événement:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * Récupère les invitations reçues par un utilisateur (temps réel)
   * 
   * @param userId - ID de l'utilisateur
   * @param status - Filtre par statut (optionnel)
   * @returns Observable<EventInvitation[]>
   */
  getUserInvitations(
    userId: string,
    status?: InvitationStatus
  ): Observable<EventInvitation[]> {
    return new Observable(observer => {
      const invitationsRef = collection(this.firestore, this.invitationsCollection);
      
      let q = query(
        invitationsRef,
        where('invitedUserId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      if (status) {
        q = query(q, where('status', '==', status));
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const invitations = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as EventInvitation))
            .filter(inv => !isInvitationExpired(inv)); // Filtrer les expirées

          observer.next(invitations);
        },
        (error) => {
          console.error('❌ Erreur récupération invitations utilisateur:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * Vérifie si un utilisateur a été invité à un événement
   * 
   * @param eventId - ID de l'événement
   * @param userId - ID de l'utilisateur
   * @returns Observable<boolean> - true si invité avec status PENDING
   */
  hasBeenInvited(eventId: string, userId: string): Observable<boolean> {
    return new Observable(observer => {
      const invitationsRef = collection(this.firestore, this.invitationsCollection);
      const q = query(
        invitationsRef,
        where('eventId', '==', eventId),
        where('invitedUserId', '==', userId),
        where('status', '==', InvitationStatus.PENDING)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          observer.next(!snapshot.empty);
        },
        (error) => {
          console.error('❌ Erreur vérification invitation:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * Récupère une invitation spécifique par son ID
   * 
   * @param invitationId - ID de l'invitation
   * @returns Promise<EventInvitation | null>
   */
  async getInvitationById(invitationId: string): Promise<EventInvitation | null> {
    try {
      const invitationRef = doc(this.firestore, this.invitationsCollection, invitationId);
      const snapshot = await getDoc(invitationRef);

      if (!snapshot.exists()) {
        return null;
      }

      return {
        id: snapshot.id,
        ...snapshot.data()
      } as EventInvitation;
    } catch (error) {
      console.error('❌ Erreur récupération invitation:', error);
      return null;
    }
  }

  // ========================================
  // ✅ ACCEPTATION D'INVITATION
  // ========================================

  /**
   * Accepte une invitation et rejoint l'événement
   * Met à jour le statut de l'invitation et supprime la notification
   * 
   * @param invitationId - ID de l'invitation
   * @returns Promise<void>
   */
  async acceptInvitation(invitationId: string): Promise<void> {
    console.log(`✅ Acceptation invitation ${invitationId}`);
  
    try {
      const invitation = await this.getInvitationById(invitationId);
      
      if (!invitation) {
        throw new Error('Invitation non trouvée');
      }
  
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error('Cette invitation a déjà été traitée');
      }
  
      if (isInvitationExpired(invitation)) {
        throw new Error('Cette invitation a expiré');
      }
  
      const currentUserId = this.authService.getCurrentUserId();
      if (!currentUserId) {
        throw new Error('Utilisateur non connecté');
      }
  
      // 1️⃣ Vérifier que l'utilisateur n'est pas déjà participant
      const participantsRef = collection(this.firestore, 'participants');
      const existingQuery = query(
        participantsRef,
        where('eventId', '==', invitation.eventId),
        where('userId', '==', currentUserId)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        console.warn('⚠️ Utilisateur déjà participant');
        throw new Error('Vous participez déjà à cet événement');
      }
  
      // 2️⃣ Créer le participant avec status APPROVED
      const participantData = {
        eventId: invitation.eventId,
        userId: invitation.invitedUserId,
        userName: invitation.invitedUserName,
        userEmail: '', // Sera rempli si disponible
        userPhoto: invitation.invitedUserPhoto,
        joinedAt: Timestamp.now(),
        status: ParticipantStatus.APPROVED
      };
  
      await addDoc(participantsRef, participantData);
      console.log('✅ Participant créé avec status APPROVED');
  
      // 3️⃣ Mettre à jour Event.currentParticipants et Event.participants[]
      const eventRef = doc(this.firestore, 'events', invitation.eventId);

      // ✅ Lire l'événement d'abord
      const eventSnapshot = await getDoc(eventRef);
      if (!eventSnapshot.exists()) {
        throw new Error('Événement non trouvé');
      }

      const eventData = eventSnapshot.data() as Event;
      const newParticipantCount = (eventData.currentParticipants || 0) + 1;

      // ✅ Construire le nouveau tableau participants manuellement
      const currentParticipants = eventData.participants || [];
      const newParticipants = currentParticipants.includes(invitation.invitedUserId)
        ? currentParticipants  // Déjà présent
        : [...currentParticipants, invitation.invitedUserId];  // Ajouter

      // ✅ Mettre à jour avec les vraies valeurs
      await updateDoc(eventRef, {
        currentParticipants: newParticipantCount,
        participants: newParticipants,
        updatedAt: Timestamp.now()
      });
      console.log('✅ Event synchronisé - Participants:', newParticipantCount);
  
      // 4️⃣ Mettre à jour le statut de l'invitation
      const invitationRef = doc(this.firestore, this.invitationsCollection, invitationId);
      await updateDoc(invitationRef, {
        status: InvitationStatus.ACCEPTED,
        respondedAt: Timestamp.now()
      });
      console.log('✅ Invitation marquée comme acceptée');
  
      // 5️⃣ Supprimer la notification d'invitation
      await this.notificationsService.deleteInvitationNotification(
        invitation.eventId,
        invitation.invitedUserId
      );
      console.log('✅ Notification d\'invitation supprimée');
  
      // 6️⃣ Envoyer une notification à l'organisateur
      const notification = createNotificationWithDefaults(
        NotificationType.EVENT_REQUEST_APPROVED,
        invitation.inviterId,
        `${invitation.invitedUserName} a accepté votre invitation à "${invitation.eventTitle}"`,
        {
          relatedEntityId: invitation.eventId,
          relatedEntityType: 'event',
          actionUrl: `/tabs/events/${invitation.eventId}`,
          senderUserId: invitation.invitedUserId,
          senderDisplayName: invitation.invitedUserName,
          senderPhotoURL: invitation.invitedUserPhoto
        }
      );
  
      await this.notificationsService.createNotification(notification);
      console.log('✅ Notification envoyée à l\'organisateur');
  
    } catch (error) {
      console.error('❌ Erreur acceptation invitation:', error);
      throw error;
    }
  }


  async deleteUserInvitation(eventId: string, userId: string): Promise<void> {
    console.log(`🗑️ Suppression invitation pour user ${userId} - event ${eventId}`);
  
    try {
      const invitationsRef = collection(this.firestore, this.invitationsCollection);
      const q = query(
        invitationsRef,
        where('eventId', '==', eventId),
        where('invitedUserId', '==', userId)
      );
  
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune invitation à supprimer');
        return;
      }
  
      // Supprimer toutes les invitations trouvées (normalement 1 seule)
      const batch = writeBatch(this.firestore);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
  
      await batch.commit();
      console.log(`✅ ${snapshot.size} invitation(s) supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression invitation utilisateur:', error);
      // Ne pas throw pour éviter de bloquer le départ
    }
  }

  // ========================================
  // ❌ REFUS D'INVITATION
  // ========================================

  /**
   * Refuse une invitation
   * Met à jour le statut et supprime la notification
   * 
   * @param invitationId - ID de l'invitation
   * @returns Promise<void>
   */
  async declineInvitation(invitationId: string): Promise<void> {
    console.log(`❌ Refus invitation ${invitationId}`);

    try {
      const invitation = await this.getInvitationById(invitationId);
      
      if (!invitation) {
        throw new Error('Invitation non trouvée');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error('Cette invitation a déjà été traitée');
      }

      // Mettre à jour le statut
      const invitationRef = doc(this.firestore, this.invitationsCollection, invitationId);
      await updateDoc(invitationRef, {
        status: InvitationStatus.DECLINED,
        respondedAt: Timestamp.now()
      });

      // Supprimer la notification
      await this.notificationsService.deleteInvitationNotification(
        invitation.eventId,
        invitation.invitedUserId
      );

      console.log('✅ Invitation refusée');
    } catch (error) {
      console.error('❌ Erreur refus invitation:', error);
      throw error;
    }
  }

  // ========================================
  // 📊 STATISTIQUES
  // ========================================

  /**
   * Calcule les statistiques d'invitations pour un événement
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<InvitationStats>
   */
  getInvitationStats(eventId: string): Observable<InvitationStats> {
    return this.getEventInvitations(eventId).pipe(
      map(invitations => {
        const totalInvited = invitations.length;
        const pendingCount = invitations.filter(i => i.status === InvitationStatus.PENDING).length;
        const acceptedCount = invitations.filter(i => i.status === InvitationStatus.ACCEPTED).length;
        const declinedCount = invitations.filter(i => i.status === InvitationStatus.DECLINED).length;

        const responded = acceptedCount + declinedCount;
        const responseRate = totalInvited > 0 ? Math.round((responded / totalInvited) * 100) : 0;

        return {
          eventId,
          totalInvited,
          pendingCount,
          acceptedCount,
          declinedCount,
          responseRate
        };
      })
    );
  }

  // ========================================
  // 🗑️ NETTOYAGE
  // ========================================

  /**
   * Supprime toutes les invitations d'un événement
   * Utilisé lors de la suppression d'un événement
   * 
   * @param eventId - ID de l'événement
   * @returns Promise<void>
   */
  async deleteEventInvitations(eventId: string): Promise<void> {
    console.log(`🗑️ Suppression de toutes les invitations pour l'événement ${eventId}`);

    try {
      const invitationsRef = collection(this.firestore, this.invitationsCollection);
      const q = query(invitationsRef, where('eventId', '==', eventId));
      const snapshot = await getDocs(q);

      const batch = writeBatch(this.firestore);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ ${snapshot.size} invitations supprimées`);
    } catch (error) {
      console.error('❌ Erreur suppression invitations événement:', error);
      throw error;
    }
  }

  /**
   * Nettoie les invitations expirées (à appeler périodiquement)
   * 
   * @returns Promise<number> - Nombre d'invitations supprimées
   */
  async cleanupExpiredInvitations(): Promise<number> {
    console.log('🧹 Nettoyage des invitations expirées');

    try {
      const now = Timestamp.now();
      const invitationsRef = collection(this.firestore, this.invitationsCollection);
      const q = query(
        invitationsRef,
        where('expiresAt', '<', now),
        where('status', '==', InvitationStatus.PENDING)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(this.firestore);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ ${snapshot.size} invitations expirées supprimées`);
      
      return snapshot.size;
    } catch (error) {
      console.error('❌ Erreur nettoyage invitations expirées:', error);
      return 0;
    }
  }

  deleteInvitation(invitationId: string): Observable<void> {
    console.log(`🗑️ Suppression invitation ${invitationId}`);

    return from(
      (async () => {
        try {
          const invitationRef = doc(this.firestore, this.invitationsCollection, invitationId);
          
          // Récupérer l'invitation avant de la supprimer (pour la notification)
          const invitationSnap = await getDoc(invitationRef);
          
          if (!invitationSnap.exists()) {
            throw new Error('Invitation non trouvée');
          }

          const invitation = invitationSnap.data() as EventInvitation;

          // Supprimer l'invitation
          await deleteDoc(invitationRef);
          console.log('✅ Invitation supprimée');

          // Supprimer la notification associée (si elle existe)
          try {
            await this.notificationsService.deleteInvitationNotification(
              invitation.eventId,
              invitation.invitedUserId
            );
            console.log('✅ Notification d\'invitation supprimée');
          } catch (notifError) {
            console.warn('⚠️ Erreur suppression notification:', notifError);
            // Ne pas bloquer si la suppression de notification échoue
          }

        } catch (error) {
          console.error('❌ Erreur suppression invitation:', error);
          throw error;
        }
      })()
    );
  }
}