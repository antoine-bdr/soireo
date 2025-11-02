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
}