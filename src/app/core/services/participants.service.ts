// src/app/core/services/participants.service.ts
// Service de gestion des participations aux événements
// ✅ VERSION AMÉLIORÉE avec notifications automatiques

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp,
  updateDoc,
  arrayUnion,
  increment,
  arrayRemove,
  serverTimestamp,
  getDoc
} from '@angular/fire/firestore';
import { Observable, from, map, switchMap, of, combineLatest } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { 
  Participant, 
  ParticipantStatus,
  ParticipationStats 
} from '../models/participant.model';
import { Event } from '../models/event.model';
import { UsersService } from './users.service';

// ✅ Import du service et du modèle de notifications
import { NotificationsService } from './notifications.service';
import { InvitationsService } from './invitations.service';
import { NotificationType, createNotificationWithDefaults } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class ParticipantsService {
  // Injection des dépendances
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  private readonly usersService = inject(UsersService);
  // ✅ Injection du service de notifications
  private readonly notificationsService = inject(NotificationsService);
  private readonly invitationsService = inject(InvitationsService);
  
  // Nom de la collection Firestore
  private readonly participantsCollection = 'participants';

  constructor() {}

  // ========================================
  // 🔵 REJOINDRE UN ÉVÉNEMENT
  // ========================================

  /**
   * Permet à un utilisateur de rejoindre un événement
   * Effectue les vérifications nécessaires puis ajoute le participant
   * ✅ MODIFIÉ : Envoie une notification à l'organisateur
   * 
   * @param eventId - ID de l'événement à rejoindre
   * @param event - Objet Event complet (pour les vérifications)
   * @returns Observable<void> qui se complète après l'ajout
   */
  joinEvent(eventId: string, event: Event): Observable<void> {
    const userId = this.authService.getCurrentUserId();
    const userName = this.authService.getCurrentUserDisplayName();
    const userEmail = this.authService.getCurrentUserEmail();
  
    if (!userId || !userEmail) {
      throw new Error('Utilisateur non connecté');
    }
  
    console.log('🔵 joinEvent appelé pour eventId:', eventId, 'userId:', userId);
  
    // Récupère le profil utilisateur pour obtenir la photo
    return this.usersService.getUserProfileOnce(userId).pipe(
      switchMap(userProfile => {
        const userPhoto = userProfile?.photoURL || '';
        console.log('📸 Photo utilisateur:', userPhoto);
  
        // Étape 1 : Vérifie que l'utilisateur ne participe pas déjà
        return this.getParticipantDocumentOneTime(eventId, userId).pipe(
          switchMap(existingParticipant => {
            if (existingParticipant) {
              console.warn('⚠️ Utilisateur déjà participant');
              throw new Error('Vous participez déjà à cet événement');
            }
  
            // Étape 2 : Vérifie que l'événement n'est pas complet
            console.log(`📢 Participants actuels: ${event.currentParticipants}/${event.maxParticipants}`);
  
            if (event.currentParticipants >= event.maxParticipants) {
              console.warn('⚠️ Événement complet');
              throw new Error('Événement complet');
            }
  
            // Étape 3 : Crée le document participant
            const participantData: Omit<Participant, 'id'> = {
              eventId,
              userId,
              userName: userName || userEmail || 'Utilisateur',
              userEmail,
              userPhoto,
              joinedAt: Timestamp.now(),
              status: event.requiresApproval 
                ? ParticipantStatus.PENDING 
                : ParticipantStatus.APPROVED
            };
  
            const participantsRef = collection(this.firestore, this.participantsCollection);
  
            // Étape 4 : Ajoute participant ET synchronise Event
            return from(addDoc(participantsRef, participantData)).pipe(
              switchMap(() => {
                console.log('✅ Participant ajouté à la collection');
  
                // Synchronise Event.currentParticipants et Event.participants[]
                const eventRef = doc(this.firestore, 'events', eventId);
                
                const updateData = {
                  currentParticipants: increment(1),        // Incrémente compteur
                  participants: arrayUnion(userId),         // Ajoute userId au array
                  updatedAt: serverTimestamp()
                };
  
                return from(updateDoc(eventRef, updateData)).pipe(
                  map(() => {
                    console.log('✅ Event.currentParticipants et Event.participants[] synchronisés');
                    
                    // ✅ NOUVEAU : Supprimer l'invitation DECLINED si elle existe (fire and forget)
                    this.invitationsService.deleteUserInvitation(eventId, userId).then(
                      () => console.log('🗑️ Invitation supprimée si elle existait'),
                      (error) => console.error('⚠️ Erreur suppression invitation (non bloquant):', error)
                    );
                    
                    // ✅ AJOUT : Envoyer une notification à l'organisateur
                    if (event.requiresApproval) {
                      // Notification pour demande de participation en attente
                      const notification = createNotificationWithDefaults(
                        NotificationType.NEW_PARTICIPANT,
                        event.organizerId,
                        `${userName || userEmail} souhaite participer à votre événement "${event.title}". Sa demande est en attente d'approbation.`,
                        {
                          relatedEntityId: eventId,
                          relatedEntityType: 'event',
                          actionUrl: `/tabs/events/${eventId}`,
                          senderUserId: userId,
                          senderDisplayName: userName || userEmail,
                          senderPhotoURL: userPhoto
                        }
                      );
                      
                      console.log('📬 Envoi notification demande de participation à l\'organisateur');
                      // Fire and forget - on n'attend pas la création de la notification
                      this.notificationsService.createOrUpdateNotification({
                        ...notification,
                        groupKey: `new_participant_${eventId}`,
                        count: 1
                      }).then(
                        () => console.log('✅ Notification envoyée à l\'organisateur'),
                        (error) => console.error('❌ Erreur envoi notification:', error)
                      );
                    } else {
                      // Notification pour participation directe (sans approbation)
                      const notification = createNotificationWithDefaults(
                        NotificationType.NEW_PARTICIPANT,
                        event.organizerId,
                        `${userName || userEmail} participe maintenant à votre événement "${event.title}".`,
                        {
                          relatedEntityId: eventId,
                          relatedEntityType: 'event',
                          actionUrl: `/tabs/events/${eventId}`,
                          senderUserId: userId,
                          senderDisplayName: userName || userEmail,
                          senderPhotoURL: userPhoto
                        }
                      );
                      
                      console.log('📬 Envoi notification nouveau participant à l\'organisateur');
                      // Fire and forget - on n'attend pas la création de la notification
                      this.notificationsService.createOrUpdateNotification({
                        ...notification,
                        groupKey: `new_participant_${eventId}`,
                        count: 1
                      }).then(
                        () => console.log('✅ Notification envoyée à l\'organisateur'),
                        (error) => console.error('❌ Erreur envoi notification:', error)
                      );
                    }
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  // ========================================
  // 🔴 QUITTER UN ÉVÉNEMENT
  // ========================================

  /**
   * Permet à un utilisateur de quitter un événement
   * Supprime le document participant correspondant
   * 
   * @param eventId - ID de l'événement à quitter
   * @returns Observable<void> qui se complète après la suppression
   */
  leaveEvent(eventId: string, userId?: string): Observable<void> {
    const userIdToLeave = userId || this.authService.getCurrentUserId();
    
    if (!userIdToLeave) {
      throw new Error('Utilisateur non connecté');
    }
  
    console.log('🔴 leaveEvent appelé pour eventId:', eventId, 'userId:', userIdToLeave);
  
    // Étape 1 : Trouver et supprimer le document participant
    return this.getParticipantDocumentOneTime(eventId, userIdToLeave).pipe(
      switchMap(participantDoc => {
        if (!participantDoc || !participantDoc.id) {
          throw new Error('Participation non trouvée');
        }
  
        const participantRef = doc(this.firestore, this.participantsCollection, participantDoc.id);
        
        return from(deleteDoc(participantRef)).pipe(
          switchMap(() => {
            console.log('✅ Document participant supprimé');
  
            // Étape 2 : Synchronise Event.currentParticipants et Event.participants[]
            const eventRef = doc(this.firestore, 'events', eventId);
            
            const updateData = {
              currentParticipants: increment(-1),           // Décrémente compteur
              participants: arrayRemove(userIdToLeave),    // Retire userId du array
              updatedAt: serverTimestamp()
            };
  
            return from(updateDoc(eventRef, updateData)).pipe(
              switchMap(() => {
                console.log('✅ Event.currentParticipants et Event.participants[] synchronisés');
                
                // ✅ NOUVEAU : Étape 3 - Supprimer les notifications de participation
                return from(
                  this.invitationsService.deleteUserInvitation(eventId, userIdToLeave)
                ).pipe(
                  switchMap(() => {
                    console.log('✅ Invitation supprimée si elle existait');
                    
                    // ✅ Étape 4 - Supprimer les notifications de participation
                    return from(
                      this.notificationsService.deleteParticipationNotifications(eventId, userIdToLeave)
                    ).pipe(
                      map(() => {
                        console.log('✅ Notifications de participation supprimées');
                      }),
                      catchError((error) => {
                        console.error('⚠️ Erreur suppression notifications (non bloquant):', error);
                        return of(void 0);
                      })
                    );
                  }),
                  catchError((error) => {
                    // ✅ Erreur non bloquante pour l'invitation
                    console.error('⚠️ Erreur suppression invitation (non bloquant):', error);
                    
                    // Continuer quand même avec la suppression des notifications
                    return from(
                      this.notificationsService.deleteParticipationNotifications(eventId, userIdToLeave)
                    ).pipe(
                      map(() => console.log('✅ Notifications supprimées')),
                      catchError(() => of(void 0))
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  // ========================================
  // 📊 RÉCUPÉRATION DES PARTICIPANTS
  // ========================================

  /**
   * Récupère tous les participants approuvés d'un événement (TEMPS RÉEL)
   * Écoute en continu les changements dans Firestore
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<Participant[]> qui émet à chaque changement
   */
  getParticipants(eventId: string): Observable<Participant[]> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef, 
        where('eventId', '==', eventId),
        where('status', '==', ParticipantStatus.APPROVED),
        orderBy('joinedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Participant));
        
        console.log(`✅ ${participants.length} participants approuvés récupérés`);
        observer.next(participants);
      }, (error) => {
        console.error('❌ Erreur getParticipants:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère les participants en attente d'approbation (TEMPS RÉEL)
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<Participant[]> liste des participants en attente
   */
  getPendingParticipants(eventId: string): Observable<Participant[]> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef,
        where('eventId', '==', eventId),
        where('status', '==', ParticipantStatus.PENDING),
        orderBy('joinedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Participant));
        
        console.log(`🔔 ${participants.length} participants en attente récupérés`);
        observer.next(participants);
      }, (error) => {
        console.error('❌ Erreur getPendingParticipants:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Compte le nombre de demandes en attente pour un événement (TEMPS RÉEL)
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<number> qui émet le nombre de demandes en attente
   */
  getPendingCount(eventId: string): Observable<number> {
    return this.getPendingParticipants(eventId).pipe(
      map(participants => participants.length)
    );
  }

  /**
   * Récupère tous les participants d'un événement, tous statuts confondus (TEMPS RÉEL)
   * Utilisé pour les statistiques ou l'administration
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<Participant[]> liste de tous les participants
   */
  getAllParticipants(eventId: string): Observable<Participant[]> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef, 
        where('eventId', '==', eventId),
        orderBy('joinedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Participant));
        
        console.log(`✅ ${participants.length} participants (tous statuts) récupérés`);
        observer.next(participants);
      }, (error) => {
        console.error('❌ Erreur getAllParticipants:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère toutes les participations d'un utilisateur (TEMPS RÉEL)
   * Utile pour afficher "Mes Événements"
   * 
   * @param userId - ID de l'utilisateur
   * @returns Observable<Participant[]> liste des participations
   */
  getParticipationsByUser(userId: string): Observable<Participant[]> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef, 
        where('userId', '==', userId),
        orderBy('joinedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Participant));
        
        console.log(`📋 ${participations.length} participations pour l'utilisateur`);
        observer.next(participations);
      }, (error) => {
        console.error('❌ Erreur getParticipationsByUser:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // 🔍 VÉRIFICATIONS
  // ========================================

  /**
   * Vérifie si un utilisateur participe déjà à un événement (TEMPS RÉEL)
   * Écoute en continu pour détecter les changements de statut
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<boolean> qui émet true si l'utilisateur participe
   */
  isUserParticipating(eventId: string): Observable<boolean> {
    const userId = this.authService.getCurrentUserId();
    
    if (!userId) {
      return of(false);
    }

    return this.getParticipantDocumentRealtime(eventId, userId).pipe(
      map(participant => {
        const isParticipating = participant !== null;
        console.log(`👤 isUserParticipating: ${isParticipating}`);
        return isParticipating;
      })
    );
  }

  /**
   * ✅ Vérifie si un utilisateur peut rejoindre un événement (TEMPS RÉEL)
   * 
   * Cette version écoute en continu les changements et réémet automatiquement.
   * À utiliser dans l'UI pour afficher l'état du bouton "Participer" en temps réel.
   * 
   * ⚡ RÉACTIVE : Réémet automatiquement quand :
   *    - L'utilisateur rejoint/quitte l'événement
   *    - Le nombre de participants change
   * 
   * @param event - Objet Event complet
   * @returns Observable qui émet { allowed: boolean, reason?: string } en continu
   */
  canJoinEventReactive(event: Event): Observable<{ allowed: boolean; reason?: string }> {
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      return of({ allowed: false, reason: 'Vous devez être connecté' });
    }

    // Vérification 1 : L'utilisateur est l'organisateur
    if (event.organizerId === userId) {
      return of({ allowed: false, reason: 'Vous êtes l\'organisateur de cet événement' });
    }

    console.log('🔍 canJoinEventReactive (TEMPS RÉEL) pour eventId:', event.id);

    // Combine les Observables temps réel SANS take(1)
    // Cela permet de réémettre à chaque changement
    return combineLatest([
      this.isUserParticipating(event.id!),
      this.getParticipantCount(event.id!)
    ]).pipe(
      map(([isParticipating, count]) => {
        console.log(`🔍 canJoinEventReactive: isParticipating=${isParticipating}, count=${count}/${event.maxParticipants}`);
        
        // Vérification 2 : L'utilisateur participe déjà 
        if (isParticipating) {
          return { allowed: false, reason: 'Vous participez déjà à cet événement' };
        }

        // Vérification 3 : L'événement est complet
        if (count >= event.maxParticipants) {
          return { allowed: false, reason: 'L\'événement est complet' };
        }

        return { allowed: true };
      })
    );
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Vérifie si un utilisateur peut rejoindre un événement (ONE-TIME)
   * 
   * Cette version effectue une vérification ponctuelle unique.
   * À utiliser dans joinEvent() pour vérifier avant d'ajouter le participant.
   * 
   * ⏱️ PONCTUELLE : Émet une seule fois puis se termine
   * 
   * @param event - Objet Event complet
   * @returns Observable qui émet { allowed: boolean, reason?: string } une seule fois
   */
  canJoinEventOneTime(event: Event): Observable<{ allowed: boolean; reason?: string }> {
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      return of({ allowed: false, reason: 'Vous devez être connecté' });
    }

    // Vérification 1 : L'utilisateur est l'organisateur
    if (event.organizerId === userId) {
      return of({ allowed: false, reason: 'Vous êtes l\'organisateur de cet événement' });
    }

    console.log('🔍 canJoinEventOneTime (PONCTUEL) pour eventId:', event.id);

    // Vérification 2 : L'utilisateur participe déjà
    return this.isUserParticipating(event.id!).pipe(
      take(1),  // ⏱️ IMPORTANT : take(1) pour une vérification ponctuelle
      switchMap(isParticipating => {
        if (isParticipating) {
          return of({ allowed: false, reason: 'Vous participez déjà à cet événement' });
        }

        // Vérification 3 : L'événement est complet
        return this.getParticipantCount(event.id!).pipe(
          take(1),  // ⏱️ IMPORTANT : take(1) pour une vérification ponctuelle
          map(count => {
            if (count >= event.maxParticipants) {
              return { allowed: false, reason: 'L\'événement est complet' };
            }
            return { allowed: true };
          })
        );
      })
    );
  }

  // ⚠️ DEPRECATED : Ancienne méthode conservée pour compatibilité
  canJoinEventObservable(event: Event): Observable<{ allowed: boolean; reason?: string }> {
    console.warn('⚠️ canJoinEventObservable est deprecated, utilisez canJoinEventReactive() ou canJoinEventOneTime()');
    return this.canJoinEventOneTime(event);
  }

  /**
   * Vérifie de manière synchrone si un événement est complet
   * Méthode utilitaire pour les vérifications simples
   * 
   * @param currentParticipants - Nombre actuel de participants
   * @param maxParticipants - Nombre maximum autorisé
   * @returns true si l'événement est complet
   */
  isEventFull(currentParticipants: number, maxParticipants: number): boolean {
    return currentParticipants >= maxParticipants;
  }

  // ========================================
  // 📈 STATISTIQUES
  // ========================================

  /**
   * Compte le nombre de participants approuvés (TEMPS RÉEL)
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<number> qui émet le nombre de participants
   */
  getParticipantCount(eventId: string): Observable<number> {
    return this.getParticipants(eventId).pipe(
      map(participants => {
        const count = participants.length;
        console.log(`📊 getParticipantCount: ${count} participants`);
        return count;
      })
    );
  }

  getUserParticipationStatus(eventId: string): Observable<ParticipantStatus | undefined> {
    const userId = this.authService.getCurrentUserId();
    
    if (!userId) {
      return of(undefined);
    }

    return this.getParticipantDocumentOneTime(eventId, userId).pipe(
      map(participant => {
        if (!participant) {
          console.log('👤 getUserParticipationStatus: Non participant');
          return undefined;
        }
        console.log('👤 getUserParticipationStatus:', participant.status);
        return participant.status;
      })
    );
  }

  getUserParticipationStatusRealtime(eventId: string): Observable<ParticipantStatus | undefined> {
    const userId = this.authService.getCurrentUserId();
    
    if (!userId) {
      return of(undefined);
    }
  
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef,
        where('eventId', '==', eventId),
        where('userId', '==', userId)
      );
  
      // ✅ Utiliser onSnapshot pour écouter les changements en temps réel
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            console.log('👤 getUserParticipationStatusRealtime: Non participant');
            observer.next(undefined);
          } else {
            const participant = snapshot.docs[0].data() as Participant;
            console.log('👤 getUserParticipationStatusRealtime:', participant.status);
            observer.next(participant.status);
          }
        },
        (error) => {
          console.error('❌ Erreur getUserParticipationStatusRealtime:', error);
          observer.error(error);
        }
      );
  
      // Cleanup
      return () => {
        console.log('🧹 Unsubscribe getUserParticipationStatusRealtime');
        unsubscribe();
      };
    });
  }

  /**
   * Récupère les statistiques complètes de participation (TEMPS RÉEL)
   * 
   * @param eventId - ID de l'événement
   * @param maxParticipants - Limite maximum
   * @returns Observable<ParticipationStats> avec toutes les stats
   */
  getParticipationStats(eventId: string, maxParticipants: number): Observable<ParticipationStats> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(participantsRef, where('eventId', '==', eventId));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => doc.data() as Participant);
        
        const approvedCount = participants.filter(p => p.status === ParticipantStatus.APPROVED).length;
        const pendingCount = participants.filter(p => p.status === ParticipantStatus.PENDING).length;

        const stats: ParticipationStats = {
          eventId,
          totalParticipants: participants.length,
          approvedCount,
          pendingCount,
          maxParticipants,
          isFull: approvedCount >= maxParticipants
        };

        console.log(`📊 Stats pour ${eventId}:`, stats);
        observer.next(stats);
      }, (error) => {
        console.error('❌ Erreur getParticipationStats:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // 👨‍💼 GESTION ORGANISATEUR
  // ========================================

  /**
   * Permet à l'organisateur de retirer un participant
   * 
   * @param participantId - ID du document participant à supprimer
   * @returns Observable<void>
   */
  removeParticipant(participantId: string): Observable<void> {
    console.log('🗑️ removeParticipant:', participantId);
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    return from(deleteDoc(participantRef));
  }

  /**
   * Approuve une participation en attente
   * ✅ MODIFIÉ : Envoie une notification au participant accepté
   * 
   * @param participantId - ID du document participant
   * @returns Observable<void>
   */
  approveParticipant(participantId: string): Observable<void> {
    console.log('✅ approveParticipant:', participantId);
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    
    // D'abord récupérer les infos du participant et de l'événement pour la notification
    return from(getDoc(participantRef)).pipe(
      switchMap(participantDoc => {
        if (!participantDoc.exists()) {
          throw new Error('Participant non trouvé');
        }
        
        const participant = participantDoc.data() as Participant;
        
        // Récupérer les infos de l'événement
        const eventRef = doc(this.firestore, 'events', participant.eventId);
        return from(getDoc(eventRef)).pipe(
          switchMap(eventDoc => {
            if (!eventDoc.exists()) {
              throw new Error('Événement non trouvé');
            }
            
            const event = eventDoc.data() as Event;
            
            // Mettre à jour le statut du participant
            return from(updateDoc(participantRef, { status: ParticipantStatus.APPROVED })).pipe(
              switchMap(() => {
                console.log('✅ Participant approuvé');
                
                // ✅ NOUVEAU : Supprimer l'invitation DECLINED si elle existe
                return from(
                  this.invitationsService.deleteUserInvitation(participant.eventId, participant.userId)
                ).pipe(
                  switchMap(() => {
                    console.log('🗑️ Invitation supprimée si elle existait');
                    
                    // ✅ Supprimer anciennes notifications de décision
                    return from(
                      this.notificationsService.deleteParticipationDecisionNotifications(
                        participant.eventId,
                        participant.userId
                      )
                    ).pipe(
                      switchMap(() => {
                        console.log('🧹 Anciennes notifications de décision supprimées');
                        
                        // ✅ Supprimer la notification de DEMANDE pour l'organisateur
                        return from(
                          this.notificationsService.deleteParticipationRequestNotifications(
                            participant.eventId,
                            participant.userId
                          )
                        ).pipe(
                          switchMap(() => {
                            console.log('🧹 Notification de demande supprimée pour l\'organisateur');
                            
                            // ✅ Créer la notification d'acceptation pour le participant
                            const notification = createNotificationWithDefaults(
                              NotificationType.EVENT_REQUEST_APPROVED,
                              participant.userId,
                              `Votre demande de participation à l'événement "${event.title}" a été acceptée ! 🎉`,
                              {
                                relatedEntityId: participant.eventId,
                                relatedEntityType: 'event',
                                actionUrl: `/tabs/events/${participant.eventId}`,
                                senderUserId: event.organizerId,
                                senderDisplayName: event.organizerName,
                                senderPhotoURL: event.organizerPhoto
                              }
                            );
                            
                            console.log('📬 Envoi notification d\'acceptation au participant');
                            
                            // Fire and forget
                            this.notificationsService.createNotification(notification).then(
                              () => console.log('✅ Notification d\'acceptation envoyée'),
                              (error) => console.error('❌ Erreur envoi notification:', error)
                            );
                            
                            return of(void 0);
                          }),
                          catchError((error) => {
                            // ✅ Gestion d'erreur non bloquante
                            console.error('⚠️ Erreur suppression notification demande (non bloquant):', error);
                            
                            // Créer quand même la notification d'acceptation
                            const notification = createNotificationWithDefaults(
                              NotificationType.EVENT_REQUEST_APPROVED,
                              participant.userId,
                              `Votre demande de participation à l'événement "${event.title}" a été acceptée ! 🎉`,
                              {
                                relatedEntityId: participant.eventId,
                                relatedEntityType: 'event',
                                actionUrl: `/tabs/events/${participant.eventId}`,
                                senderUserId: event.organizerId,
                                senderDisplayName: event.organizerName,
                                senderPhotoURL: event.organizerPhoto
                              }
                            );
                            
                            this.notificationsService.createNotification(notification).catch(err =>
                              console.error('❌ Erreur envoi notification:', err)
                            );
                            
                            return of(void 0);
                          })
                        );
                      }),
                      catchError((error) => {
                        console.error('⚠️ Erreur suppression notifications décision (non bloquant):', error);
                        
                        // Continuer quand même avec la notification de demande
                        return from(
                          this.notificationsService.deleteParticipationRequestNotifications(
                            participant.eventId,
                            participant.userId
                          )
                        ).pipe(
                          switchMap(() => {
                            // Créer la notification d'acceptation
                            const notification = createNotificationWithDefaults(
                              NotificationType.EVENT_REQUEST_APPROVED,
                              participant.userId,
                              `Votre demande de participation à l'événement "${event.title}" a été acceptée ! 🎉`,
                              {
                                relatedEntityId: participant.eventId,
                                relatedEntityType: 'event',
                                actionUrl: `/tabs/events/${participant.eventId}`,
                                senderUserId: event.organizerId,
                                senderDisplayName: event.organizerName,
                                senderPhotoURL: event.organizerPhoto
                              }
                            );
                            
                            this.notificationsService.createNotification(notification).catch(err =>
                              console.error('❌ Erreur envoi notification:', err)
                            );
                            
                            return of(void 0);
                          }),
                          catchError(() => {
                            // Dernier recours : créer la notification sans supprimer
                            const notification = createNotificationWithDefaults(
                              NotificationType.EVENT_REQUEST_APPROVED,
                              participant.userId,
                              `Votre demande de participation à l'événement "${event.title}" a été acceptée ! 🎉`,
                              {
                                relatedEntityId: participant.eventId,
                                relatedEntityType: 'event',
                                actionUrl: `/tabs/events/${participant.eventId}`,
                                senderUserId: event.organizerId,
                                senderDisplayName: event.organizerName,
                                senderPhotoURL: event.organizerPhoto
                              }
                            );
                            
                            this.notificationsService.createNotification(notification).catch(err =>
                              console.error('❌ Erreur envoi notification:', err)
                            );
                            
                            return of(void 0);
                          })
                        );
                      })
                    );
                  }),
                  catchError((error) => {
                    // ✅ Erreur suppression invitation non bloquante
                    console.error('⚠️ Erreur suppression invitation (non bloquant):', error);
                    
                    // Continuer avec le reste du processus
                    return from(
                      this.notificationsService.deleteParticipationDecisionNotifications(
                        participant.eventId,
                        participant.userId
                      )
                    ).pipe(
                      switchMap(() => {
                        const notification = createNotificationWithDefaults(
                          NotificationType.EVENT_REQUEST_APPROVED,
                          participant.userId,
                          `Votre demande de participation à l'événement "${event.title}" a été acceptée ! 🎉`,
                          {
                            relatedEntityId: participant.eventId,
                            relatedEntityType: 'event',
                            actionUrl: `/tabs/events/${participant.eventId}`,
                            senderUserId: event.organizerId,
                            senderDisplayName: event.organizerName,
                            senderPhotoURL: event.organizerPhoto
                          }
                        );
                        
                        this.notificationsService.createNotification(notification).catch(err =>
                          console.error('❌ Erreur envoi notification:', err)
                        );
                        
                        return of(void 0);
                      }),
                      catchError(() => of(void 0))
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  /**
   * Rejette une participation en attente
   * ✅ MODIFIÉ : Envoie une notification au participant refusé
   * 
   * @param participantId - ID du document participant
   * @returns Observable<void>
   */
  rejectParticipant(participantId: string): Observable<void> {
    console.log('❌ rejectParticipant:', participantId);
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    
    // D'abord récupérer les infos du participant et de l'événement pour la notification
    return from(getDoc(participantRef)).pipe(
      switchMap(participantDoc => {
        if (!participantDoc.exists()) {
          throw new Error('Participant non trouvé');
        }
        
        const participant = participantDoc.data() as Participant;
        
        // Récupérer les infos de l'événement
        const eventRef = doc(this.firestore, 'events', participant.eventId);
        return from(getDoc(eventRef)).pipe(
          switchMap(eventDoc => {
            if (!eventDoc.exists()) {
              throw new Error('Événement non trouvé');
            }
            
            const event = eventDoc.data() as Event;
            
            // Mettre à jour le statut du participant
            return from(updateDoc(participantRef, { status: ParticipantStatus.REJECTED })).pipe(
              switchMap(() => {
                console.log('❌ Participant rejeté');
                
                // ✅ Supprimer anciennes notifications de décision
                return from(
                  this.notificationsService.deleteParticipationDecisionNotifications(
                    participant.eventId,
                    participant.userId
                  )
                ).pipe(
                  switchMap(() => {
                    console.log('🧹 Anciennes notifications de décision supprimées');
                    
                    // ✅ NOUVEAU : Supprimer la notification de DEMANDE pour l'organisateur
                    return from(
                      this.notificationsService.deleteParticipationRequestNotifications(
                        participant.eventId,
                        participant.userId
                      )
                    ).pipe(
                      switchMap(() => {
                        console.log('🧹 Notification de demande supprimée pour l\'organisateur');
                        
                        // ✅ Créer la notification de refus pour le participant
                        const notification = createNotificationWithDefaults(
                          NotificationType.EVENT_REQUEST_REJECTED,
                          participant.userId,
                          `Votre demande de participation à l'événement "${event.title}" a été refusée.`,
                          {
                            relatedEntityId: participant.eventId,
                            relatedEntityType: 'event',
                            actionUrl: `/tabs/events/${participant.eventId}`,
                            senderUserId: event.organizerId,
                            senderDisplayName: event.organizerName,
                            senderPhotoURL: event.organizerPhoto
                          }
                        );
                        
                        console.log('📬 Envoi notification de refus au participant');
                        
                        // Fire and forget
                        this.notificationsService.createNotification(notification).then(
                          () => console.log('✅ Notification de refus envoyée'),
                          (error) => console.error('❌ Erreur envoi notification:', error)
                        );
                        
                        return of(void 0);
                      }),
                      catchError((error) => {
                        // ✅ Gestion d'erreur non bloquante
                        console.error('⚠️ Erreur suppression notification demande (non bloquant):', error);
                        
                        // Créer quand même la notification de refus
                        const notification = createNotificationWithDefaults(
                          NotificationType.EVENT_REQUEST_REJECTED,
                          participant.userId,
                          `Votre demande de participation à l'événement "${event.title}" a été refusée.`,
                          {
                            relatedEntityId: participant.eventId,
                            relatedEntityType: 'event',
                            actionUrl: `/tabs/events/${participant.eventId}`,
                            senderUserId: event.organizerId,
                            senderDisplayName: event.organizerName,
                            senderPhotoURL: event.organizerPhoto
                          }
                        );
                        
                        this.notificationsService.createNotification(notification).catch(err =>
                          console.error('❌ Erreur envoi notification:', err)
                        );
                        
                        return of(void 0);
                      })
                    );
                  }),
                  catchError((error) => {
                    // Gestion d'erreur pour deleteParticipationDecisionNotifications
                    console.error('⚠️ Erreur nettoyage notifications (non bloquant):', error);
                    
                    // Créer quand même la notification de refus
                    const notification = createNotificationWithDefaults(
                      NotificationType.EVENT_REQUEST_REJECTED,
                      participant.userId,
                      `Votre demande de participation à l'événement "${event.title}" a été refusée.`,
                      {
                        relatedEntityId: participant.eventId,
                        relatedEntityType: 'event',
                        actionUrl: `/tabs/events/${participant.eventId}`,
                        senderUserId: event.organizerId,
                        senderDisplayName: event.organizerName,
                        senderPhotoURL: event.organizerPhoto
                      }
                    );
                    
                    this.notificationsService.createNotification(notification).catch(err =>
                      console.error('❌ Erreur envoi notification:', err)
                    );
                    
                    return of(void 0);
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  // ========================================
  // 🔧 MÉTHODES UTILITAIRES PRIVÉES
  // ========================================

  /**
   * ⚡ Récupère le document participant en TEMPS RÉEL
   * 
   * Utilisée par isUserParticipating() pour avoir la réactivité continue.
   * Écoute en continu les changements dans Firestore avec onSnapshot.
   * 
   * @param eventId - ID de l'événement
   * @param userId - ID de l'utilisateur
   * @returns Observable<Participant | null> qui émet à chaque changement
   */
  getParticipantDocumentRealtime(eventId: string, userId: string): Observable<Participant | null> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef,
        where('eventId', '==', eventId),
        where('userId', '==', userId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          console.log('🔍 getParticipantDocumentRealtime: aucun document trouvé');
          observer.next(null);
        } else {
          const doc = snapshot.docs[0];
          const participant = { id: doc.id, ...doc.data() } as Participant;
          console.log('🔍 getParticipantDocumentRealtime: document trouvé', participant.id);
          observer.next(participant);
        }
      }, (error) => {
        console.error('❌ Erreur getParticipantDocumentRealtime:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * ⏱️ Récupère le document participant ONE-TIME
   * 
   * Utilisée pour joinEvent() et leaveEvent() où on veut juste une vérification ponctuelle.
   * Effectue une requête unique avec getDocs (pas de réactivité).
   * 
   * @param eventId - ID de l'événement
   * @param userId - ID de l'utilisateur
   * @returns Observable<Participant | null> qui émet une seule fois
   */
  getParticipantDocumentOneTime(eventId: string, userId: string): Observable<Participant | null> {
    const participantsRef = collection(this.firestore, this.participantsCollection);
    const q = query(
      participantsRef,
      where('eventId', '==', eventId),
      where('userId', '==', userId)
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        if (snapshot.empty) {
          console.log('🔍 getParticipantDocumentOneTime: aucun document trouvé');
          return null;
        }
        const doc = snapshot.docs[0];
        const participant = { id: doc.id, ...doc.data() } as Participant;
        console.log('🔍 getParticipantDocumentOneTime: document trouvé', participant.id);
        return participant;
      })
    );
  }
}