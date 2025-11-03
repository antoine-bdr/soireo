// src/app/core/services/messages.service.ts
// 💬 Service de gestion de la messagerie privée
// ✅ CORRECTION: getUserConversations() maintenant en temps réel avec onSnapshot

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
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  increment,
  WriteBatch,
  writeBatch,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable, map, switchMap, combineLatest, of, from } from 'rxjs';

import {
  Message,
  Conversation,
  CreateMessageDto,
  CreateConversationDto,
  ConversationListItem,
  MessageStats,
  MessageStatus,
  generateConversationId,
  getFriendIdFromConversation,
  getFriendDataFromConversation
} from '../models/message.model';
import { UsersService } from './users.service';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class MessagesService {
  private readonly firestore = inject(Firestore);
  private readonly usersService = inject(UsersService);
  private readonly notificationsService = inject(NotificationsService);

  private readonly conversationsCollection = collection(this.firestore, 'conversations');

  // ========================================
  // 🔧 HELPERS INTERNES
  // ========================================

  /**
   * ✅ Nettoie un objet en retirant les propriétés undefined
   * Firestore rejette les valeurs undefined, il faut les supprimer complètement
   * 
   * @param obj Objet à nettoyer
   * @returns Objet nettoyé sans propriétés undefined
   */
  private removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }

  // ========================================
  // 💬 GESTION DES CONVERSATIONS
  // ========================================

  /**
   * 📋 Récupère toutes les conversations d'un utilisateur (TEMPS RÉEL)
   * ✅ CORRIGÉ: Utilise maintenant onSnapshot pour les mises à jour en temps réel
   * Triées par dernière activité
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable de conversations (mis à jour en temps réel)
   */
  getUserConversations(userId: string): Observable<ConversationListItem[]> {
    console.log(`📨 [MessagesService] ═══════════════════════════════════`);
    console.log(`📨 [MessagesService] getUserConversations() START`);
    console.log(`📨 [MessagesService] userId: ${userId}`);
    console.log(`📨 [MessagesService] ═══════════════════════════════════`);
  
    const conversationsCol = collection(this.firestore, 'conversations');
    
    const q = query(
      conversationsCol,
      where('participantIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
  
    // ✅ CORRECTION: Utiliser onSnapshot pour le temps réel
    return new Observable<ConversationListItem[]>(observer => {
      console.log(`📨 [MessagesService] Création du listener onSnapshot pour ${userId}`);
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          console.log(`📨 [MessagesService] ═════════════════════════════════════════`);
          console.log(`📨 [MessagesService] 🎯 onSnapshot DÉCLENCHÉ!`);
          console.log(`📨 [MessagesService] ${snapshot.docs.length} conversations trouvées`);

          const conversations = snapshot.docs.map(doc => {
            const conv = { id: doc.id, ...doc.data() } as Conversation;
            
            const friendId = getFriendIdFromConversation(conv, userId);
            const friendData = getFriendDataFromConversation(conv, userId);
    
            const item: ConversationListItem = {
              conversationId: conv.id!,
              friendId,
              friendDisplayName: friendData.displayName,
              friendPhotoURL: friendData.photoURL,
              lastMessageText: conv.lastMessage?.text || '',
              lastMessageTime: conv.lastMessage?.createdAt.toDate() || conv.createdAt.toDate(),
              unreadCount: conv.unreadCount[userId] || 0
            };

            console.log(`📨 [MessagesService] Conversation: ${item.friendDisplayName}, unread: ${item.unreadCount}`);
            return item;
          });

          // ✅ IMPORTANT: Compter le nombre total de messages non lus
          const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
          const unreadConversationCount = conversations.filter(conv => conv.unreadCount > 0).length;
          
          console.log(`📨 [MessagesService] ✅ Total conversations non lues: ${unreadConversationCount}`);
          console.log(`📨 [MessagesService] ✅ Total messages non lus: ${totalUnread}`);
          console.log(`📨 [MessagesService] ═════════════════════════════════════════`);
          
          observer.next(conversations);
        },
        (error) => {
          console.error(`❌ [MessagesService] Erreur onSnapshot:`, error);
          observer.error(error);
        }
      );
  
      // Cleanup
      return () => {
        console.log(`📨 [MessagesService] Unsubscribe onSnapshot pour ${userId}`);
        unsubscribe();
      };
    });
  }

  /**
   * 🔍 Récupère ou crée une conversation entre deux utilisateurs
   * 
   * @param userId1 UID du premier utilisateur
   * @param userId2 UID du second utilisateur
   * @returns Promise<Conversation>
   */
  async getOrCreateConversation(userId1: string, userId2: string): Promise<Conversation> {
    console.log(`🔍 [MessagesService] Get/Create conversation: ${userId1} ↔ ${userId2}`);

    const conversationId = generateConversationId(userId1, userId2);
    const docRef = doc(this.firestore, 'conversations', conversationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log(`✅ [MessagesService] Conversation existante: ${conversationId}`);
      return { id: docSnap.id, ...docSnap.data() } as Conversation;
    }

    // Créer une nouvelle conversation
    console.log(`➕ [MessagesService] Création nouvelle conversation: ${conversationId}`);

    const [user1, user2] = await Promise.all([
      this.usersService.getUserProfileOnce(userId1).toPromise(),
      this.usersService.getUserProfileOnce(userId2).toPromise()
    ]);

    if (!user1 || !user2) {
      throw new Error('Utilisateur introuvable');
    }

    // ✅ Préparer les données de conversation (photoURL peut être undefined)
    const conversationData: CreateConversationDto = {
      participant1Id: userId1,
      participant1DisplayName: user1.displayName,
      participant1PhotoURL: user1.photoURL,
      participant2Id: userId2,
      participant2DisplayName: user2.displayName,
      participant2PhotoURL: user2.photoURL
    };

    const newConversationBase: Omit<Conversation, 'id'> = {
      ...conversationData,
      participantIds: [userId1, userId2],
      unreadCount: {
        [userId1]: 0,
        [userId2]: 0
      },
      totalMessagesCount: 0,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };

    // ✅ Nettoyer les champs undefined avant d'envoyer à Firestore
    const newConversation = this.removeUndefinedFields(newConversationBase);

    await setDoc(docRef, newConversation);
    console.log(`✅ [MessagesService] Conversation créée: ${conversationId}`);

    return { id: conversationId, ...newConversation } as Conversation;
  }

  /**
   * 🔍 Récupère une conversation par ID
   * 
   * @param conversationId ID de la conversation
   * @returns Observable<Conversation | null>
   */
  getConversationById(conversationId: string): Observable<Conversation | null> {
    const docRef = doc(this.firestore, 'conversations', conversationId);

    return from(getDoc(docRef)).pipe(
      map(docSnap => {
        if (!docSnap.exists()) {
          return null;
        }
        return { id: docSnap.id, ...docSnap.data() } as Conversation;
      })
    );
  }

  // ========================================
  // 📨 GESTION DES MESSAGES
  // ========================================

  /**
   * 📋 Récupère tous les messages d'une conversation (temps réel)
   * Triés par ordre chronologique
   * 
   * @param conversationId ID de la conversation
   * @param limitCount Nombre max de messages (défaut: 100)
   * @returns Observable de messages
   */
  getConversationMessages(
    conversationId: string,
    limitCount: number = 100
  ): Observable<Message[]> {
    console.log(`📋 [MessagesService] Chargement messages pour conversation ${conversationId}`);

    const messagesCollection = collection(
      this.firestore,
      'conversations',
      conversationId,
      'messages'
    );

    const q = query(
      messagesCollection,
      orderBy('createdAt', 'asc'),
      limit(limitCount)
    );

    // ✅ Utiliser onSnapshot pour le temps réel
    return new Observable<Message[]>(observer => {
      const unsubscribe = onSnapshot(q,
        snapshot => {
          console.log(`✅ [MessagesService] ${snapshot.docs.length} messages chargés`);

          const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Message[];

          observer.next(messages);
        },
        error => {
          console.error('❌ [MessagesService] Erreur chargement messages:', error);
          observer.error(error);
        }
      );

      // Cleanup
      return () => unsubscribe();
    });
  }

  /**
   * ✅ CORRECTION : Envoie un message dans une conversation
   * Met à jour la conversation avec le dernier message
   * Incrémente le compteur de non-lus du destinataire
   * Crée une notification pour le destinataire
   * 
   * ⚠️ Important : Nettoie les champs undefined avant d'envoyer à Firestore
   * 
   * @param messageDto Données du message
   * @param receiverId UID du destinataire
   * @returns Promise avec l'ID du message
   */
  async sendMessage(messageDto: CreateMessageDto, receiverId: string): Promise<string> {
    console.log(`➕ [MessagesService] Envoi message dans conversation ${messageDto.conversationId}`);

    try {
      // Référence à la sous-collection messages
      const messagesCollection = collection(
        this.firestore,
        'conversations',
        messageDto.conversationId,
        'messages'
      );

      // ✅ Créer le message de base
      const messageDataBase: Omit<Message, 'id'> = {
        conversationId: messageDto.conversationId,
        senderId: messageDto.senderId,
        senderDisplayName: messageDto.senderDisplayName,
        text: messageDto.text,
        type: messageDto.type || 'text',
        status: MessageStatus.SENT,
        isEdited: false,
        isDeleted: false,
        createdAt: serverTimestamp() as Timestamp
      };

      // ✅ Ajouter les champs optionnels seulement s'ils existent
      if (messageDto.senderPhotoURL) {
        (messageDataBase as any).senderPhotoURL = messageDto.senderPhotoURL;
      }
      if (messageDto.imageUrl) {
        (messageDataBase as any).imageUrl = messageDto.imageUrl;
      }

      // ✅ Sécurité supplémentaire : nettoyer les undefined
      const messageData = this.removeUndefinedFields(messageDataBase);

      const messageRef = await addDoc(messagesCollection, messageData);
      console.log(`✅ [MessagesService] Message créé: ${messageRef.id}`);

      await updateDoc(messageRef, {
        status: MessageStatus.DELIVERED,
        updatedAt: serverTimestamp()
      });

      // Mettre à jour la conversation
      const conversationRef = doc(this.firestore, 'conversations', messageDto.conversationId);
      
      await updateDoc(conversationRef, {
        lastMessage: {
          text: messageDto.text,
          senderId: messageDto.senderId,
          createdAt: serverTimestamp(),
          isRead: false
        },
        updatedAt: serverTimestamp(),
        totalMessagesCount: increment(1),
        [`unreadCount.${receiverId}`]: increment(1)
      });

      console.log(`✅ [MessagesService] Conversation mise à jour`);
      console.log(`📨 [MessagesService] ✅ Le compteur de messages non lus pour ${receiverId} a été incrémenté!`);

      // ⛔ DÉSACTIVÉ : Notifications NEW_MESSAGE supprimées
      // Les utilisateurs ne recevront plus de notifications pour les nouveaux messages
      // Le badge de compteur de conversations non lues reste actif dans l'onglet Messages

      return messageRef.id;
    } catch (error) {
      console.error('❌ [MessagesService] Erreur envoi message:', error);
      throw error;
    }
  }

  /**
   * ✅ Compte le nombre de conversations avec messages non lus
   * Badge : 1 conversation avec 3 messages non lus = badge "1"
   *          2 conversations avec messages non lus = badge "2"
   * 
   * @param userId UID de l'utilisateur
   * @returns Observable du nombre de conversations non lues
   */
  getUnreadMessagesCount(userId: string): Observable<number> {
    console.log(`📨 [MessagesService] getUnreadMessagesCount() pour ${userId}`);
    
    return this.getMessageStats(userId).pipe(
      map(stats => {
        console.log(`📨 [MessagesService] ✅ getUnreadMessagesCount retourne: ${stats.unreadConversations} conversations non lues`);
        return stats.unreadConversations;
      })
    );
  }

  /**
   * 📊 Récupère les statistiques de messages
   * @param userId UID de l'utilisateur
   * @returns Observable<MessageStats>
   */
  getMessageStats(userId: string): Observable<MessageStats> {
    console.log(`📨 [MessagesService] getMessageStats() pour ${userId}`);
    
    return this.getUserConversations(userId).pipe(
      map(conversations => {
        const totalUnread = conversations.reduce(
          (sum, conv) => sum + conv.unreadCount,
          0
        );
        const unreadConversations = conversations.filter(
          conv => conv.unreadCount > 0
        ).length;

        const lastMessage = conversations.length > 0
          ? conversations[0].lastMessageTime
          : undefined;

        const stats: MessageStats = {
          totalConversations: conversations.length,
          unreadConversations,
          totalUnreadMessages: totalUnread,
          lastMessageAt: lastMessage
        };

        console.log(`📨 [MessagesService] Stats complètes:`, stats);
        return stats;
      })
    );
  }

  // ========================================
  // 🔧 HELPERS
  // ========================================

  /**
   * 🔍 Vérifie si une conversation existe entre deux utilisateurs
   * 
   * @param userId1 UID du premier utilisateur
   * @param userId2 UID du second utilisateur
   * @returns Promise<boolean>
   */
  async conversationExists(userId1: string, userId2: string): Promise<boolean> {
    const conversationId = generateConversationId(userId1, userId2);
    const docRef = doc(this.firestore, 'conversations', conversationId);
    const docSnap = await getDoc(docRef);

    return docSnap.exists();
  }

  /**
   * 🗑️ Supprime une conversation complète (avec tous les messages)
   * ⚠️ Opération irréversible !
   * 
   * @param conversationId ID de la conversation
   * @returns Promise<void>
   */
  async deleteConversation(conversationId: string): Promise<void> {
    console.log(`🗑️ [MessagesService] Suppression conversation: ${conversationId}`);

    try {
      // Supprimer tous les messages de la conversation
      const messagesCollection = collection(
        this.firestore,
        'conversations',
        conversationId,
        'messages'
      );

      const messagesSnapshot = await getDocs(messagesCollection);
      const batch: WriteBatch = writeBatch(this.firestore);

      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Supprimer la conversation elle-même
      const conversationRef = doc(this.firestore, 'conversations', conversationId);
      batch.delete(conversationRef);

      await batch.commit();
      console.log(`✅ [MessagesService] Conversation supprimée`);
    } catch (error) {
      console.error('❌ [MessagesService] Erreur suppression conversation:', error);
      throw error;
    }
  }

  // ========================================
  // ✍️ TYPING INDICATOR
  // ========================================

  /**
   * ✍️ Met à jour le statut "en train d'écrire" pour un utilisateur
   * 
   * @param conversationId ID de la conversation
   * @param userId UID de l'utilisateur qui tape
   * @param isTyping true pour activer, false pour désactiver
   */
  async setTypingStatus(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    try {
      const conversationRef = doc(this.firestore, 'conversations', conversationId);
      
      if (isTyping) {
        // Activer le typing avec timestamp actuel
        await updateDoc(conversationRef, {
          [`typing.${userId}`]: serverTimestamp()
        });
      } else {
        // Désactiver le typing (supprimer le champ)
        await updateDoc(conversationRef, {
          [`typing.${userId}`]: null
        });
      }
    } catch (error) {
      console.error('❌ Erreur setTypingStatus:', error);
      // Ne pas throw l'erreur pour ne pas bloquer l'envoi du message
    }
  }

  /**
   * ✍️ Observe le statut "en train d'écrire" d'un utilisateur spécifique
   * 
   * @param conversationId ID de la conversation
   * @param userId UID de l'utilisateur à observer
   * @returns Observable<boolean> - true si en train d'écrire
   */
  observeTypingStatus(conversationId: string, userId: string): Observable<boolean> {
    const conversationRef = doc(this.firestore, 'conversations', conversationId);
    
    return new Observable<boolean>(observer => {
      const unsubscribe = onSnapshot(conversationRef, 
        (docSnap) => {
          if (!docSnap.exists()) {
            observer.next(false);
            return;
          }
          
          const conversation = docSnap.data() as Conversation;
          
          // Vérifier si l'utilisateur est en train d'écrire
          if (!conversation.typing || !conversation.typing[userId]) {
            observer.next(false);
            return;
          }
          
          const typingTimestamp = conversation.typing[userId].toDate();
          const now = new Date();
          const diffSeconds = (now.getTime() - typingTimestamp.getTime()) / 1000;
          
          // En train d'écrire si < 3 secondes
          observer.next(diffSeconds < 3);
        },
        (error) => {
          console.error('❌ Erreur observeTypingStatus:', error);
          observer.error(error);
        }
      );
      
      return () => unsubscribe();
    });
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    console.log(`✅ [MessagesService] Marquage conversation comme lue: ${conversationId}`);
  
    try {
      // 1. Récupérer tous les messages non lus de l'ami
      const messagesCollection = collection(
        this.firestore,
        'conversations',
        conversationId,
        'messages'
      );
  
      const q = query(
        messagesCollection,
        where('senderId', '!=', userId), // Messages de l'ami uniquement
        where('status', 'in', ['sent', 'delivered']) // Messages non lus
      );
  
      const snapshot = await getDocs(q);
  
      // 2. Mettre à jour tous les messages non lus en batch
      if (snapshot.size > 0) {
        const batch = writeBatch(this.firestore);
  
        snapshot.docs.forEach(docSnap => {
          const messageRef = doc(
            this.firestore,
            'conversations',
            conversationId,
            'messages',
            docSnap.id
          );
  
          batch.update(messageRef, {
            status: MessageStatus.READ,
            readAt: serverTimestamp()
          });
        });
  
        await batch.commit();
        console.log(`✅ [MessagesService] ${snapshot.size} message(s) marqué(s) comme lu(s)`);
      }
  
      // 3. Mettre à jour le compteur de non-lus dans la conversation
      const conversationRef = doc(this.firestore, 'conversations', conversationId);
      
      await updateDoc(conversationRef, {
        [`unreadCount.${userId}`]: 0
      });
  
      console.log(`✅ [MessagesService] Conversation marquée comme lue`);
    } catch (error) {
      console.error('❌ [MessagesService] Erreur marquage lecture:', error);
      throw error;
    }
  }

  // ========================================
  // ✏️ ÉDITION ET SUPPRESSION DE MESSAGES
  // ========================================

  /**
   * ✏️ Modifie un message existant
   */
  async editMessage(
    conversationId: string,
    messageId: string,
    newText: string
  ): Promise<void> {
    console.log('✏️ [MessagesService] Modification message:', messageId);

    try {
      const messageRef = doc(
        this.firestore,
        'conversations',
        conversationId,
        'messages',
        messageId
      );

      await updateDoc(messageRef, {
        text: newText,
        isEdited: true,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Message modifié');
    } catch (error) {
      console.error('❌ Erreur modification message:', error);
      throw error;
    }
  }

  /**
   * 🗑️ Supprime un message (soft delete)
   */
  async deleteMessage(
    conversationId: string,
    messageId: string
  ): Promise<void> {
    console.log('🗑️ [MessagesService] Suppression message:', messageId);

    try {
      const messageRef = doc(
        this.firestore,
        'conversations',
        conversationId,
        'messages',
        messageId
      );

      await updateDoc(messageRef, {
        text: 'Message supprimé',
        isDeleted: true,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Message supprimé');
    } catch (error) {
      console.error('❌ Erreur suppression message:', error);
      throw error;
    }
  }

  // ========================================
  // 😍 RÉACTIONS
  // ========================================

  /**
   * 😍 Ajoute une réaction à un message
   * Un utilisateur ne peut avoir qu'UNE réaction par message
   * Si une réaction existe déjà, elle est remplacée
   */
  async addReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
    userId: string,
    userDisplayName: string
  ): Promise<void> {
    console.log('😍 [MessagesService] Ajout réaction:', emoji);

    try {
      const messageRef = doc(
        this.firestore,
        'conversations',
        conversationId,
        'messages',
        messageId
      );

      const messageDoc = await getDoc(messageRef);
      if (!messageDoc.exists()) {
        throw new Error('Message introuvable');
      }

      const messageData = messageDoc.data() as Message;
      let reactions = messageData.reactions || [];

      // ✅ Retirer TOUTE réaction existante de cet utilisateur
      reactions = reactions.filter(r => r.userId !== userId);

      // ✅ Ajouter la nouvelle réaction
      reactions.push({
        emoji,
        userId,
        userDisplayName,
        createdAt: Timestamp.now()
      });

      await updateDoc(messageRef, {
        reactions: reactions.length > 0 ? reactions : []
      });

      console.log('✅ Réaction ajoutée/remplacée');
    } catch (error) {
      console.error('❌ Erreur ajout réaction:', error);
      throw error;
    }
  }
}