// src/app/core/services/friends.service.ts
// 👥 Service de gestion des relations d'amitié
// ✅ CORRECTION : Ne pas stocker collection comme propriété de classe

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  or,
  and,
  getDocs,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable, map, combineLatest, of, switchMap, from } from 'rxjs';

import {
  Friendship,
  CreateFriendshipDto,
  FriendListItem,
  UserSearchResult,
  FriendshipStats,
  getFriendId,
  getFriendData,
  FriendshipStatus
} from '../models/friend.model';
import { User } from '../models/user.model';
import { UsersService } from './users.service';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class FriendsService {
  private readonly firestore = inject(Firestore);
  private readonly usersService = inject(UsersService);
  private readonly notificationsService = inject(NotificationsService);
  
  // ❌ NE PAS FAIRE : private readonly friendshipsCollection = collection(this.firestore, 'friendships');
  // ✅ À LA PLACE : Créer la collection dans chaque méthode

  // ========================================
  // 🔍 RECHERCHE D'UTILISATEURS
  // ========================================

  /**
   * 🔍 Recherche d'utilisateurs par nom (displayName)
   * Exclut l'utilisateur courant des résultats
   * 
   * @param searchTerm Terme de recherche
   * @param currentUserId UID de l'utilisateur courant
   * @param limitCount Nombre max de résultats (défaut: 20)
   * @returns Observable de résultats avec statut d'amitié
   */
  searchUsers(
    searchTerm: string,
    currentUserId: string,
    limitCount: number = 20
  ): Observable<UserSearchResult[]> {
    console.log(`🔍 [FriendsService] Recherche utilisateurs: "${searchTerm}"`);

    if (!searchTerm || searchTerm.trim().length < 2) {
      console.log('⚠️ [FriendsService] Terme de recherche trop court');
      return of([]);
    }

    const searchLower = searchTerm.toLowerCase().trim();

    // ✅ Recherche directe dans Firestore avec filtrage côté client (insensible à la casse)
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('isActive', '==', true));

    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        // Mapper les documents en objets User
        const allUsers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        // Filtrer côté client (insensible à la casse)
        const filteredUsers = allUsers.filter(user => {
          // Exclure l'utilisateur courant
          if (user.id === currentUserId) return false;

          const displayNameLower = (user.displayName || '').toLowerCase();
          const emailLower = (user.email || '').toLowerCase();
          const firstNameLower = (user.firstName || '').toLowerCase();
          const lastNameLower = (user.lastName || '').toLowerCase();

          return displayNameLower.includes(searchLower) ||
                 emailLower.includes(searchLower) ||
                 firstNameLower.includes(searchLower) ||
                 lastNameLower.includes(searchLower);
        }).slice(0, limitCount);

        console.log(`✅ [FriendsService] ${filteredUsers.length} utilisateurs trouvés`);

        if (filteredUsers.length === 0) {
          return of([]);
        }

        // Récupérer les friendships pour connaître le statut avec chaque user
        return this.getAllFriendshipsForUser(currentUserId).pipe(
          map(friendships => {
            return filteredUsers.map(user => {
              // Trouver la friendship existante avec cet utilisateur
              const friendship = friendships.find(f =>
                f.senderId === user.id || f.receiverId === user.id
              );

              const result: UserSearchResult = {
                userId: user.id,
                displayName: user.displayName,
                photoURL: user.photoURL,
                bio: user.bio,
                city: user.city,
                isFriend: friendship?.status === 'accepted',
                isPendingRequest: friendship?.status === 'pending',
                isSentByMe: friendship?.senderId === currentUserId
              };

              if (friendship) {
                result.friendshipStatus = friendship.status;
                result.friendshipId = friendship.id;
              }

              return result;
            });
          })
        );
      })
    );
  }

  // ========================================
  // 👥 GESTION DES AMIS
  // ========================================

  /**
   * 👥 Récupère la liste des amis acceptés (temps réel)
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable de la liste d'amis
   */
  getFriends(userId: string): Observable<FriendListItem[]> {
    console.log(`👥 [FriendsService] Chargement amis pour ${userId}`);

    // ✅ CORRECTION : Créer la collection ICI, dans la méthode
    const friendshipsCol = collection(this.firestore, 'friendships');
    
    const q = query(
      friendshipsCol,
      or(
        and(where('senderId', '==', userId), where('status', '==', 'accepted')),
        and(where('receiverId', '==', userId), where('status', '==', 'accepted'))
      ),
      orderBy('acceptedAt', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(friendships => {
        console.log(`✅ [FriendsService] ${friendships.length} amis trouvés`);
        
        return (friendships as Friendship[]).map(friendship => {
          const friendId = getFriendId(friendship, userId);
          const friendData = getFriendData(friendship, userId);

          return {
            friendshipId: friendship.id!,
            userId: friendId,
            displayName: friendData.displayName,
            photoURL: friendData.photoURL,
            status: friendship.status,
            isPending: false,
            isSender: friendship.senderId === userId,
            friendSince: friendship.acceptedAt?.toDate()
          };
        });
      })
    );
  }

  /**
   * 📬 Récupère les demandes d'amis reçues (temps réel)
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable des demandes reçues
   */
  getPendingReceivedRequests(userId: string): Observable<FriendListItem[]> {
    console.log(`📬 [FriendsService] Chargement demandes reçues pour ${userId}`);
  
    const friendshipsCol = collection(this.firestore, 'friendships');
    
    const q = query(
      friendshipsCol,
      where('receiverId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
  
    // ✅ Utiliser onSnapshot au lieu de collectionData pour éviter les problèmes de typage
    return new Observable<FriendListItem[]>(observer => {
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const friendships = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Friendship[];
          
          console.log(`✅ [FriendsService] ${friendships.length} demandes reçues`);
          
          const result = friendships.map(friendship => ({
            friendshipId: friendship.id!,
            userId: friendship.senderId,
            displayName: friendship.senderDisplayName,
            photoURL: friendship.senderPhotoURL,
            status: friendship.status,
            isPending: true,
            isSender: false,
            friendSince: undefined
          }));
          
          observer.next(result);
        },
        (error) => {
          console.error('❌ [FriendsService] Erreur getPendingReceivedRequests:', error);
          observer.error(error);
        }
      );
      
      return () => unsubscribe();
    });
  }

  /**
   * 📤 Récupère les demandes d'amis envoyées (temps réel)
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable des demandes envoyées
   */
  getPendingSentRequests(userId: string): Observable<FriendListItem[]> {
    console.log(`📤 [FriendsService] Chargement demandes envoyées pour ${userId}`);

    // ✅ CORRECTION : Créer la collection ICI
    const friendshipsCol = collection(this.firestore, 'friendships');
    
    const q = query(
      friendshipsCol,
      where('senderId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(friendships => {
        console.log(`✅ [FriendsService] ${friendships.length} demandes envoyées`);
        
        return (friendships as Friendship[]).map(friendship => ({
          friendshipId: friendship.id!,
          userId: friendship.receiverId,
          displayName: friendship.receiverDisplayName,
          photoURL: friendship.receiverPhotoURL,
          status: friendship.status,
          isPending: true,
          isSender: true,
          friendSince: undefined
        }));
      })
    );
  }

  /**
   * 📊 Récupère toutes les friendships d'un utilisateur (helper interne)
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable de toutes les friendships
   */
  private getAllFriendshipsForUser(userId: string): Observable<Friendship[]> {
    const friendshipsCol = collection(this.firestore, 'friendships');
    
    const q = query(
      friendshipsCol,
      or(
        where('senderId', '==', userId),
        where('receiverId', '==', userId)
      )
    );

    // ✅ Utiliser onSnapshot au lieu de collectionData
    return new Observable<Friendship[]>(observer => {
      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const friendships = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Friendship[];
          
          observer.next(friendships);
        },
        (error) => {
          console.error('❌ [FriendsService] Erreur getAllFriendshipsForUser:', error);
          observer.error(error);
        }
      );
      
      return () => unsubscribe();
    });
  }

  /**
   * 📊 Récupère les statistiques d'amitié
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable des stats
   */
  getFriendshipStats(userId: string): Observable<FriendshipStats> {
    const friends$ = this.getFriends(userId);
    const pendingReceived$ = this.getPendingReceivedRequests(userId);
    const pendingSent$ = this.getPendingSentRequests(userId);

    return combineLatest([friends$, pendingReceived$, pendingSent$]).pipe(
      map(([friends, received, sent]) => ({
        totalFriends: friends.length,
        pendingReceived: received.length,
        pendingSent: sent.length,
        blockedUsers: 0 // TODO: Implémenter si besoin
      }))
    );
  }

  // ========================================
  // ➕ ENVOI DE DEMANDE D'AMI
  // ========================================

  /**
   * ➕ Envoie une demande d'ami
   * Crée une notification pour le destinataire
   * 
   * @param senderId UID de l'expéditeur
   * @param receiverId UID du destinataire
   * @returns Promise avec l'ID de la friendship
   */
  async sendFriendRequest(senderId: string, receiverId: string): Promise<string> {
    console.log(`➕ [FriendsService] Envoi demande ami: ${senderId} → ${receiverId}`);

    try {
      // Vérifier qu'une friendship n'existe pas déjà
      const existing = await this.checkExistingFriendship(senderId, receiverId);
      if (existing) {
        throw new Error('Une relation existe déjà avec cet utilisateur');
      }

      // ✅ Récupérer les données des deux utilisateurs avec getUserProfileOnce
      const [sender, receiver] = await Promise.all([
        this.usersService.getUserProfileOnce(senderId).toPromise(),
        this.usersService.getUserProfileOnce(receiverId).toPromise()
      ]);

      if (!sender || !receiver) {
        throw new Error('Utilisateur introuvable');
      }

      // Créer la friendship
      const friendshipDto: CreateFriendshipDto = {
        senderId,
        receiverId,
        senderDisplayName: sender.displayName,
        senderPhotoURL: sender.photoURL,
        receiverDisplayName: receiver.displayName,
        receiverPhotoURL: receiver.photoURL
      };

      const friendshipData: Omit<Friendship, 'id'> = {
        ...friendshipDto,
        status: FriendshipStatus.PENDING,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };

      // ✅ CORRECTION : Créer la collection ICI
      const friendshipsCol = collection(this.firestore, 'friendships');
      const docRef = await addDoc(friendshipsCol, friendshipData);
      console.log(`✅ [FriendsService] Demande ami créée: ${docRef.id}`);

      // Créer une notification pour le destinataire
      await this.notificationsService.createNotificationByType(
        NotificationType.FRIEND_REQUEST,
        receiverId,
        `${sender.displayName} vous a envoyé une demande d'ami`,
        {
          relatedEntityId: docRef.id,
          relatedEntityType: 'friendship',
          actionUrl: '/social/friend-search',
          senderUserId: senderId,
          senderDisplayName: sender.displayName,
          senderPhotoURL: sender.photoURL
        }
      );

      return docRef.id;
    } catch (error) {
      console.error('❌ [FriendsService] Erreur envoi demande ami:', error);
      throw error;
    }
  }

  /**
   * ✅ Accepte une demande d'ami
   * Crée une notification pour l'expéditeur
   * 
   * @param friendshipId ID de la friendship
   * @param userId UID de l'utilisateur qui accepte (doit être le receiver)
   * @returns Promise<void>
   */
  async acceptFriendRequest(friendshipId: string, userId: string): Promise<void> {
    console.log(`✅ [FriendsService] Acceptation demande ami: ${friendshipId}`);

    try {
      const docRef = doc(this.firestore, 'friendships', friendshipId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Demande d\'ami introuvable');
      }

      const friendship = { id: docSnap.id, ...docSnap.data() } as Friendship;

      // Vérifier que l'utilisateur est bien le receiver
      if (friendship.receiverId !== userId) {
        throw new Error('Vous ne pouvez pas accepter cette demande');
      }

      // Mettre à jour le statut
      await updateDoc(docRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log(`✅ [FriendsService] Demande acceptée: ${friendshipId}`);

      // Créer une notification pour l'expéditeur
      await this.notificationsService.createNotificationByType(
        NotificationType.FRIEND_ACCEPTED,
        friendship.senderId,
        `${friendship.receiverDisplayName} a accepté votre demande d'ami`,
        {
          relatedEntityId: friendshipId,
          relatedEntityType: 'friendship',
          actionUrl: `/social/friend-profile/${userId}`,
          senderUserId: userId,
          senderDisplayName: friendship.receiverDisplayName,
          senderPhotoURL: friendship.receiverPhotoURL
        }
      );
    } catch (error) {
      console.error('❌ [FriendsService] Erreur acceptation demande:', error);
      throw error;
    }
  }

  /**
   * ❌ Refuse/Annule une demande d'ami
   * 
   * @param friendshipId ID de la friendship
   * @returns Promise<void>
   */
  async rejectFriendRequest(friendshipId: string): Promise<void> {
    console.log(`❌ [FriendsService] Refus demande ami: ${friendshipId}`);

    try {
      const docRef = doc(this.firestore, 'friendships', friendshipId);
      await deleteDoc(docRef);
      console.log(`✅ [FriendsService] Demande refusée: ${friendshipId}`);
    } catch (error) {
      console.error('❌ [FriendsService] Erreur refus demande:', error);
      throw error;
    }
  }

  /**
   * 🗑️ Supprime un ami (supprime la friendship)
   * 
   * @param friendshipId ID de la friendship
   * @returns Promise<void>
   */
  async removeFriend(friendshipId: string): Promise<void> {
    console.log(`🗑️ [FriendsService] Suppression ami: ${friendshipId}`);

    try {
      const docRef = doc(this.firestore, 'friendships', friendshipId);
      await deleteDoc(docRef);
      console.log(`✅ [FriendsService] Ami supprimé: ${friendshipId}`);
    } catch (error) {
      console.error('❌ [FriendsService] Erreur suppression ami:', error);
      throw error;
    }
  }

  // ========================================
  // 🔧 HELPERS
  // ========================================

  /**
   * 🔍 Vérifie si une friendship existe déjà entre deux utilisateurs
   * 
   * @param userId1 UID du premier utilisateur
   * @param userId2 UID du second utilisateur
   * @returns Promise<Friendship | null>
   */
  private async checkExistingFriendship(
    userId1: string,
    userId2: string
  ): Promise<Friendship | null> {
    // ✅ CORRECTION : Créer la collection ICI
    const friendshipsCol = collection(this.firestore, 'friendships');
    
    const q = query(
      friendshipsCol,
      or(
        and(where('senderId', '==', userId1), where('receiverId', '==', userId2)),
        and(where('senderId', '==', userId2), where('receiverId', '==', userId1))
      )
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Friendship;
  }

  /**
   * ✅ Vérifie si deux utilisateurs sont amis
   * 
   * @param userId1 UID du premier utilisateur
   * @param userId2 UID du second utilisateur
   * @returns Observable<boolean>
   */
  areFriends(userId1: string, userId2: string): Observable<boolean> {
    return from(this.checkExistingFriendship(userId1, userId2)).pipe(
      map(friendship => friendship?.status === 'accepted')
    );
  }
}