// src/app/core/services/notifications.service.ts
// 🔔 Service de gestion des notifications
// Gère la création, lecture, et suppression des notifications utilisateur

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  WriteBatch,
  writeBatch,
  onSnapshot,
  getDocs
} from '@angular/fire/firestore';
import { Observable, map, combineLatest } from 'rxjs';

import {
  Notification,
  CreateNotificationDto,
  NotificationStats,
  NotificationType,
  createNotificationWithDefaults
} from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private readonly firestore = inject(Firestore);

  // ========================================
  // 📖 LECTURE DES NOTIFICATIONS
  // ========================================

  /**
   * 📋 Récupère toutes les notifications d'un utilisateur (temps réel)
   * Triées par date décroissante (plus récentes en premier)
   * 
   * @param userId UID de l'utilisateur
   * @param limitCount Nombre max de notifications (défaut: 50)
   * @returns Observable de notifications
   */
  getUserNotifications(userId: string, limitCount: number = 50): Observable<Notification[]> {
    const notificationsCollection = collection(this.firestore, 'notifications');
    console.log(`🔔 [NotificationsService] Chargement des notifications pour ${userId}`);

    return new Observable(observer => {
      const q = query(
        notificationsCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      // ✅ Utiliser onSnapshot natif de Firebase
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const notifications: Notification[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Notification));
          
          console.log(`✅ [NotificationsService] ${notifications.length} notifications chargées`);
          observer.next(notifications);
        },
        (error) => {
          console.error('❌ [NotificationsService] Erreur chargement:', error);
          observer.error(error);
        }
      );

      // Cleanup
      return () => unsubscribe();
    });
  }

  /**
   * 📬 Récupère uniquement les notifications NON LUES (temps réel)
   * ⚡ Version ultra-simplifiée : récupère toutes les notifications et filtre côté client
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable de notifications non lues
   */
  getUnreadNotifications(userId: string): Observable<Notification[]> {
    const notificationsCollection = collection(this.firestore, 'notifications');
    console.log(`📬 [NotificationsService] Chargement notifications non lues pour ${userId}`);

    return new Observable(observer => {
      // ⚡ Requête la plus simple possible : juste userId
      const q = query(
        notificationsCollection,
        where('userId', '==', userId)
      );

      console.log('🔍 [NotificationsService] Requête créée, attente des données...');

      // ✅ Utiliser onSnapshot natif de Firebase
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          console.log(`📦 [NotificationsService] Snapshot reçu, ${snapshot.docs.length} documents trouvés`);
          
          // Mapper les documents
          let notifications: Notification[] = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log(`📄 [NotificationsService] Document ${doc.id}:`, data);
            return {
              id: doc.id,
              ...data
            } as Notification;
          });
          
          // ⚡ Filtrer côté client pour ne garder que les non lues
          notifications = notifications.filter(n => !n.isRead);
          
          // Trier manuellement par date décroissante
          notifications = notifications.sort((a, b) => {
            const dateA = a.createdAt?.toMillis() || 0;
            const dateB = b.createdAt?.toMillis() || 0;
            return dateB - dateA;
          });
          
          console.log(`✅ [NotificationsService] ${notifications.length} notifications non lues (filtrées côté client)`);
          observer.next(notifications);
        },
        (error) => {
          console.error('❌ [NotificationsService] Erreur chargement non lues:', error);
          observer.error(error);
        }
      );

      // Cleanup
      return () => {
        console.log('🧹 [NotificationsService] Unsubscribe from notifications');
        unsubscribe();
      };
    });
  }

  /**
   * 🔢 Compte le nombre de notifications non lues (temps réel)
   * Utilisé pour afficher le badge dans le header
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable du compteur
   */
  getUnreadCount(userId: string): Observable<number> {
    console.log('🔢 [NotificationsService] getUnreadCount() appelé pour:', userId);
    
    return new Observable(observer => {
      console.log('🔢 [NotificationsService] Création de l\'Observable du compteur');
      
      // S'abonner aux notifications non lues
      const subscription = this.getUnreadNotifications(userId).subscribe({
        next: (notifications) => {
          const count = notifications.length;
          console.log(`🔢 [NotificationsService] 🎯 COMPTEUR MIS À JOUR: ${count}`);
          console.log(`🔢 [NotificationsService] Notifications reçues:`, notifications);
          observer.next(count);
        },
        error: (error) => {
          console.error('🔢 [NotificationsService] ❌ ERREUR dans getUnreadCount:', error);
          observer.error(error);
        },
        complete: () => {
          console.log('🔢 [NotificationsService] ✅ getUnreadCount complete');
        }
      });
      
      // Cleanup
      return () => {
        console.log('🧹 [NotificationsService] Unsubscribe du compteur');
        subscription.unsubscribe();
      };
    });
  }

  /**
   * 📊 Récupère les statistiques de notifications
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable des stats
   */
  getNotificationStats(userId: string): Observable<NotificationStats> {
    const allNotifications$ = this.getUserNotifications(userId);
    const unreadNotifications$ = this.getUnreadNotifications(userId);

    return combineLatest([allNotifications$, unreadNotifications$]).pipe(
      map(([all, unread]) => {
        const lastNotif = all.length > 0 ? all[0].createdAt.toDate() : undefined;

        return {
          unreadCount: unread.length,
          totalCount: all.length,
          lastNotificationAt: lastNotif
        };
      })
    );
  }

  // ========================================
  // ✏️ CRÉATION DE NOTIFICATIONS
  // ========================================

  /**
   * ➕ Crée une nouvelle notification
   * 
   * @param notificationDto Données de la notification
   * @returns Promise avec l'ID de la notification créée
   */
  async createNotification(notificationDto: CreateNotificationDto): Promise<string> {
    const notificationsCollection = collection(this.firestore, 'notifications');
    console.log('➕ [NotificationsService] Création notification:', notificationDto);

    try {
      const notificationData: Omit<Notification, 'id'> = {
        ...notificationDto,
        isRead: false,
        createdAt: serverTimestamp() as Timestamp
      };

      const docRef = await addDoc(notificationsCollection, notificationData);
      console.log(`✅ [NotificationsService] Notification créée: ${docRef.id}`);

      return docRef.id;
    } catch (error) {
      console.error('❌ [NotificationsService] Erreur création notification:', error);
      throw error;
    }
  }

  /**
   * ➕ Crée une notification avec config par défaut selon le type
   * Wrapper pratique autour de createNotification()
   * 
   * @param type Type de notification
   * @param userId Destinataire
   * @param message Message personnalisé
   * @param overrides Options supplémentaires
   * @returns Promise avec l'ID
   */
  async createNotificationByType(
    type: NotificationType,
    userId: string,
    message: string,
    overrides?: Partial<CreateNotificationDto>
  ): Promise<string> {
    const notificationDto = createNotificationWithDefaults(type, userId, message, overrides);
    return this.createNotification(notificationDto);
  }

  /**
   * 📨 Crée plusieurs notifications en batch (optimisé)
   * Utilisé pour notifier plusieurs utilisateurs d'un coup
   * 
   * @param notifications Tableau de notifications à créer
   * @returns Promise<void>
   */
  async createBatchNotifications(notifications: CreateNotificationDto[]): Promise<void> {
    const notificationsCollection = collection(this.firestore, 'notifications');
    console.log(`📨 [NotificationsService] Création batch de ${notifications.length} notifications`);

    try {
      const batch: WriteBatch = writeBatch(this.firestore);

      notifications.forEach(notifDto => {
        const docRef = doc(notificationsCollection);
        const notificationData: Omit<Notification, 'id'> = {
          ...notifDto,
          isRead: false,
          createdAt: serverTimestamp() as Timestamp
        };
        batch.set(docRef, notificationData);
      });

      await batch.commit();
      console.log(`✅ [NotificationsService] Batch de ${notifications.length} notifications créé`);
    } catch (error) {
      console.error('❌ [NotificationsService] Erreur création batch:', error);
      throw error;
    }
  }

  // Ajouter ces 2 méthodes APRÈS createBatchNotifications() (vers ligne ~295)

/**
 * ✅ Crée ou met à jour une notification avec regroupement
 * Si une notification similaire existe (< 5 min), on l'update
 */
async createOrUpdateNotification(
  notificationData: CreateNotificationDto
): Promise<void> {
  const notificationsCollection = collection(this.firestore, 'notifications');  // ✅ CORRECTION
  
  try {
    // ✅ Si pas de groupKey, créer normalement
    if (!notificationData.groupKey) {
      await this.createNotification(notificationData);
      return;
    }

    // ✅ Chercher notification existante (< 5 minutes)
    const fiveMinutesAgo = Timestamp.fromDate(
      new Date(Date.now() - 5 * 60 * 1000)
    );

    const q = query(
      notificationsCollection,
      where('userId', '==', notificationData.userId),
      where('groupKey', '==', notificationData.groupKey),
      where('createdAt', '>=', fiveMinutesAgo)
    );

    const snapshot = await getDocs(q);

    // ✅ Si trouvée : UPDATE
    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      const existingData = existingDoc.data() as Notification;
      const currentCount = existingData.count || 1;
      const newCount = currentCount + (notificationData.count || 1);

      // Construire le message agrégé
      const updatedMessage = this.buildAggregatedMessage(
        notificationData.type,
        notificationData.senderDisplayName || 'Quelqu\'un',
        newCount,
        notificationData.title
      );

      await updateDoc(doc(this.firestore, 'notifications', existingDoc.id), {
        count: newCount,
        message: updatedMessage,
        lastUpdatedAt: Timestamp.now(),
        isRead: false  // ✅ Remettre non-lu
      });

      console.log(`✅ Notification agrégée (count: ${newCount})`);
    } 
    // ✅ Si aucune : CREATE
    else {
      await this.createNotification({
        ...notificationData,
        count: notificationData.count || 1
      });
      console.log('✅ Nouvelle notification créée');
    }

  } catch (error) {
    console.error('❌ Erreur création/update notification:', error);
    throw error;
  }
}

/**
 * ✅ Construit un message agrégé selon le type
 */
private buildAggregatedMessage(
  type: NotificationType,
  senderName: string,
  count: number,
  originalTitle: string
): string {
  switch (type) {
    case NotificationType.SYSTEM:
      // Pour les photos
      if (originalTitle.includes('photo')) {
        if (count > 1) {
          return `${senderName} a ajouté ${count} photos`;
        }
        return `${senderName} a ajouté une photo`;
      }
      // Pour les publications
      if (originalTitle.includes('publication')) {
        if (count > 1) {
          return `${senderName} a publié ${count} fois`;
        }
        return `${senderName} a publié`;
      }
      return `${count} nouvelles actions`;
  
    case NotificationType.NEW_PARTICIPANT:
      if (count > 1) {
        return `${count} personnes ont rejoint l'événement`;
      }
      return `${senderName} a rejoint l'événement`;
  
    case NotificationType.EVENT_UPDATED:  // ✅ CORRIGER l'indentation
      if (count > 1) {
        return `L'événement a été modifié ${count} fois`;
      }
      return `L'événement a été mis à jour`;
  
    default:
      return `${count} nouvelles actions`;
  }
}

  // ========================================
  // ✅ MARQUAGE COMME LU
  // ========================================

  /**
   * ✅ Marque une notification comme lue
   * 
   * @param notificationId ID de la notification
   * @returns Promise<void>
   */
  async markAsRead(notificationId: string): Promise<void> {
    console.log(`✅ [NotificationsService] Marquage comme lu: ${notificationId}`);

    try {
      const docRef = doc(this.firestore, 'notifications', notificationId);
      await updateDoc(docRef, {
        isRead: true,
        readAt: serverTimestamp()
      });

      console.log(`✅ [NotificationsService] Notification ${notificationId} marquée comme lue`);
    } catch (error) {
      console.error('❌ [NotificationsService] Erreur marquage lecture:', error);
      throw error;
    }
  }

  /**
   * ✅ Marque toutes les notifications d'un utilisateur comme lues (batch)
   * 
   * @param userId UID de l'utilisateur
   * @returns Promise<void>
   */
  async markAllAsRead(userId: string): Promise<void> {
    const notificationsCollection = collection(this.firestore, 'notifications');
    console.log(`✅ [NotificationsService] Marquage toutes notifs comme lues pour ${userId}`);

    try {
      // Récupérer toutes les notifications non lues (une seule fois)
      const q = query(
        notificationsCollection,
        where('userId', '==', userId),
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('ℹ️ [NotificationsService] Aucune notification à marquer');
        return;
      }

      // Batch update
      const batch: WriteBatch = writeBatch(this.firestore);

      snapshot.docs.forEach(docSnapshot => {
        batch.update(docSnapshot.ref, {
          isRead: true,
          readAt: serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`✅ [NotificationsService] ${snapshot.docs.length} notifications marquées comme lues`);
    } catch (error) {
      console.error('❌ [NotificationsService] Erreur marquage toutes lectures:', error);
      throw error;
    }
  }

  // ========================================
  // 🗑️ SUPPRESSION
  // ========================================

  /**
   * 🗑️ Supprime une notification
   * 
   * @param notificationId ID de la notification
   * @returns Promise<void>
   */
  async deleteNotification(notificationId: string): Promise<void> {
    console.log(`🗑️ [NotificationsService] Suppression notification: ${notificationId}`);

    try {
      const docRef = doc(this.firestore, 'notifications', notificationId);
      await deleteDoc(docRef);
      console.log(`✅ [NotificationsService] Notification ${notificationId} supprimée`);
    } catch (error) {
      console.error('❌ [NotificationsService] Erreur suppression:', error);
      throw error;
    }
  }

  async decrementOrDeleteNotification(groupKey: string, userId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      // ✅ Chercher la notification avec ce groupKey
      const q = query(
        notificationsCollection,
        where('userId', '==', userId),
        where('groupKey', '==', groupKey)
      );
  
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification à décrémenter');
        return;
      }
  
      const notifDoc = snapshot.docs[0];
      const notifData = notifDoc.data() as Notification;
      const currentCount = notifData.count || 1;
  
      // ✅ Si count = 1 → Supprimer
      if (currentCount <= 1) {
        await deleteDoc(notifDoc.ref);
        console.log('✅ Notification supprimée (count = 1)');
      } 
      // ✅ Si count > 1 → Décrémenter
      else {
        const newCount = currentCount - 1;
        const updatedMessage = this.buildAggregatedMessage(
          notifData.type,
          notifData.senderDisplayName || 'Quelqu\'un',
          newCount,
          notifData.title
        );
  
        await updateDoc(notifDoc.ref, {
          count: newCount,
          message: updatedMessage,
          lastUpdatedAt: Timestamp.now()
        });
  
        console.log(`✅ Notification décrémentée (count: ${currentCount} → ${newCount})`);
      }
    } catch (error) {
      console.error('❌ Erreur décrémentation notification:', error);
      throw error;
    }
  }
  
  /**
   * ✅ Supprime complètement une notification agrégée (même si count > 1)
   * Utilisé quand on supprime TOUTES les actions liées
   * @param groupKey Clé de regroupement
   * @param userId ID du destinataire
   */
  async deleteGroupedNotification(groupKey: string, userId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      const q = query(
        notificationsCollection,
        where('userId', '==', userId),
        where('groupKey', '==', groupKey)
      );
  
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification à supprimer');
        return;
      }
  
      // ✅ Supprimer toutes les notifications trouvées (normalement 1 seule)
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${snapshot.size} notification(s) groupée(s) supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression notification groupée:', error);
      throw error;
    }
  }

  /**
   * 🗑️ Supprime toutes les notifications lues d'un utilisateur
   * Utile pour nettoyer l'historique
   * 
   * @param userId UID de l'utilisateur
   * @returns Promise<void>
   */
  async deleteReadNotifications(userId: string): Promise<void> {
    const notificationsCollection = collection(this.firestore, 'notifications');
    console.log(`🗑️ [NotificationsService] Suppression notifications lues pour ${userId}`);

    try {
      // Récupérer toutes les notifications lues
      const q = query(
        notificationsCollection,
        where('userId', '==', userId),
        where('isRead', '==', true)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('ℹ️ [NotificationsService] Aucune notification lue à supprimer');
        return;
      }

      // Batch delete
      const batch: WriteBatch = writeBatch(this.firestore);

      snapshot.docs.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();
      console.log(`✅ [NotificationsService] ${snapshot.docs.length} notifications supprimées`);
    } catch (error) {
      console.error('❌ [NotificationsService] Erreur suppression notifications lues:', error);
      throw error;
    }
  }

  // ========================================
  // 🧹 NETTOYAGE AUTO (OPTIONNEL)
  // ========================================

  /**
   * 🧹 Supprime les notifications expirées
   * À appeler périodiquement ou via Cloud Function
   * 
   * @returns Promise<void>
   */
  async cleanupExpiredNotifications(): Promise<void> {
    const notificationsCollection = collection(this.firestore, 'notifications');
    console.log('🧹 [NotificationsService] Nettoyage notifications expirées');

    try {
      const now = Timestamp.now();
      const q = query(
        notificationsCollection,
        where('expiresAt', '<=', now)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('ℹ️ [NotificationsService] Aucune notification expirée');
        return;
      }

      const batch: WriteBatch = writeBatch(this.firestore);

      snapshot.docs.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();
      console.log(`✅ [NotificationsService] ${snapshot.docs.length} notifications expirées supprimées`);
    } catch (error) {
      console.error('❌ [NotificationsService] Erreur nettoyage:', error);
      throw error;
    }
  }

  // Ajouter ces méthodes dans NotificationsService (après deleteReadNotifications)

  /**
   * ✅ Supprime les notifications liées à une demande de participation annulée
   * @param eventId ID de l'événement
   * @param userId ID de l'utilisateur qui annule
   */
  async deleteParticipationNotifications(eventId: string, userId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      // ✅ Chercher toutes les notifications NEW_PARTICIPANT pour cet event et cet user
      const q = query(
        notificationsCollection,
        where('relatedEntityId', '==', eventId),
        where('senderUserId', '==', userId),
        where('type', '==', NotificationType.NEW_PARTICIPANT)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification à supprimer');
        return;
      }

      // ✅ Supprimer toutes les notifications trouvées
      const deletePromises = snapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );

      await Promise.all(deletePromises);
      console.log(`✅ ${snapshot.size} notification(s) de participation supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression notifications participation:', error);
      throw error;
    }
  }

  /**
   * ✅ Supprime toutes les notifications liées à un événement
   * Utilisé lors de la suppression d'un événement
   * @param eventId ID de l'événement supprimé
   */
  async deleteEventNotifications(eventId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      // ✅ Chercher TOUTES les notifications pour cet événement
      const q = query(
        notificationsCollection,
        where('relatedEntityId', '==', eventId)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification à supprimer pour cet événement');
        return;
      }

      // ✅ Supprimer par batch
      const batch = writeBatch(this.firestore);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ ${snapshot.size} notification(s) d'événement supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression notifications événement:', error);
      throw error;
    }
  }

  async deleteFriendRequestNotification(friendshipId: string, receiverId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      // ✅ Chercher la notification FRIEND_REQUEST pour cette friendship
      const q = query(
        notificationsCollection,
        where('userId', '==', receiverId),
        where('relatedEntityId', '==', friendshipId),
        where('type', '==', NotificationType.FRIEND_REQUEST)
      );
  
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification de demande d\'ami à supprimer');
        return;
      }
  
      // ✅ Supprimer toutes les notifications trouvées
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${snapshot.size} notification(s) de demande d'ami supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression notification demande ami:', error);
      throw error;
    }
  }

  // Ajouter après deleteFriendRequestNotification() (après ligne ~745)

/**
 * ✅ Supprime TOUTES les notifications liées à une friendship
 * (FRIEND_REQUEST + FRIEND_ACCEPTED)
 * Utilisé lors de la suppression d'une friendship (reject ou remove)
 * @param friendshipId ID de la friendship
 */
  async deleteAllFriendshipNotifications(friendshipId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      // ✅ Chercher TOUTES les notifications pour cette friendship
      const q = query(
        notificationsCollection,
        where('relatedEntityId', '==', friendshipId),
        where('relatedEntityType', '==', 'friendship')
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification de friendship à supprimer');
        return;
      }

      // ✅ Supprimer toutes les notifications trouvées
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${snapshot.size} notification(s) de friendship supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression notifications friendship:', error);
      throw error;
    }
  }

  async deleteParticipationDecisionNotifications(eventId: string, userId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      // ✅ Chercher les notifications APPROVED ou REJECTED pour cet event/user
      const q = query(
        notificationsCollection,
        where('userId', '==', userId),
        where('relatedEntityId', '==', eventId),
        where('type', 'in', [
          NotificationType.EVENT_REQUEST_APPROVED,
          NotificationType.EVENT_REQUEST_REJECTED
        ])
      );
  
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification de décision à supprimer');
        return;
      }
  
      // ✅ Supprimer toutes les notifications trouvées
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${snapshot.size} notification(s) de décision supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression notifications décision:', error);
      throw error;
    }
  }

  async deleteParticipationRequestNotifications(eventId: string, requesterId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      // ✅ Chercher les notifications NEW_PARTICIPANT pour cet événement et cet utilisateur
      const q = query(
        notificationsCollection,
        where('relatedEntityId', '==', eventId),
        where('relatedEntityType', '==', 'event'),
        where('senderUserId', '==', requesterId),
        where('type', '==', NotificationType.NEW_PARTICIPANT)  // ✅ CORRIGER ICI
      );
  
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification de demande de participation à supprimer');
        return;
      }
  
      // ✅ Supprimer toutes les notifications trouvées
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${snapshot.size} notification(s) de demande de participation supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression notifications demande participation:', error);
      throw error;
    }
  }
 

  /**
   * ✅ Supprime les notifications d'invitation pour un événement et un utilisateur
   * Utilisé quand l'invité accepte/refuse l'invitation
   * @param eventId ID de l'événement
   * @param invitedUserId ID de l'utilisateur invité
   */
  async deleteInvitationNotification(eventId: string, invitedUserId: string): Promise<void> {
    try {
      const notificationsCollection = collection(this.firestore, 'notifications');
      
      // Chercher les notifications EVENT_INVITATION pour cet événement et cet utilisateur
      const q = query(
        notificationsCollection,
        where('relatedEntityId', '==', eventId),
        where('relatedEntityType', '==', 'event'),
        where('userId', '==', invitedUserId),
        where('type', '==', NotificationType.EVENT_INVITATION)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('ℹ️ Aucune notification d\'invitation à supprimer');
        return;
      }

      // Supprimer toutes les notifications trouvées
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ ${snapshot.size} notification(s) d\'invitation supprimée(s)`);
    } catch (error) {
      console.error('❌ Erreur suppression notifications invitation:', error);
      throw error;
    }
  }

  async notifyEventCancelled(
    eventId: string,
    eventTitle: string,
    participantIds: string[]
  ): Promise<void> {
    if (participantIds.length === 0) {
      console.log('ℹ️ Aucun participant à notifier');
      return;
    }
    
    console.log(`📬 Notification de suppression à ${participantIds.length} participant(s)`);
    
    try {
      const notifications = participantIds.map(userId =>
        this.createNotification({
          userId,
          type: NotificationType.EVENT_CANCELLED,
          title: 'Événement annulé',
          message: `L'événement "${eventTitle}" a été supprimé par l'organisateur`,
          icon: 'trash-outline',
          color: 'danger',
          relatedEntityId: eventId,
          relatedEntityType: 'event'
        })
      );
      
      await Promise.all(notifications);
      console.log('✅ Notifications d\'annulation envoyées');
    } catch (error) {
      console.error('❌ Erreur envoi notifications annulation:', error);
      // Ne pas bloquer le processus principal
    }
  }
 
}