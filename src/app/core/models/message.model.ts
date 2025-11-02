// src/app/core/models/message.model.ts
// 💬 Modèle de données pour la messagerie privée
// ✅ ÉTAPE 2 : Ajout du typing indicator

import { Timestamp } from '@angular/fire/firestore';

/**
 * 📌 Statuts d'un message
 */
export enum MessageStatus {
  SENT = 'sent',           // Envoyé
  DELIVERED = 'delivered', // Délivré (reçu par le serveur)
  READ = 'read'            // Lu par le destinataire
}

export interface MessageReaction {
  emoji: string;           // L'emoji de la réaction
  userId: string;          // Qui a réagi
  userDisplayName: string; // Nom de l'utilisateur
  createdAt: Timestamp;    // Quand
}

/**
 * 💬 Interface principale pour un message individuel
 */
export interface Message {
  // ========================================
  // 🆔 IDENTIFICATION
  // ========================================
  id?: string;
  conversationId: string;
  
  // ========================================
  // 👤 EXPÉDITEUR
  // ========================================
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string;
  
  // ========================================
  // 📝 CONTENU
  // ========================================
  text: string;
  type: 'text' | 'image' | 'system';
  imageUrl?: string;
  
  // ========================================
  // 📊 STATUT
  // ========================================
  status: MessageStatus;
  readAt?: Timestamp;
  
  // ========================================
  // 📅 MÉTADONNÉES
  // ========================================
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  isEdited: boolean;
  isDeleted: boolean;

  reactions?: MessageReaction[];
}

/**
 * 💬 Interface pour une conversation (métadonnées)
 * ✅ ÉTAPE 2 : Ajout du champ typing
 */
export interface Conversation {
  // ========================================
  // 🆔 IDENTIFICATION
  // ========================================
  id?: string;
  
  // ========================================
  // 👥 PARTICIPANTS
  // ========================================
  participantIds: string[];
  
  participant1Id: string;
  participant1DisplayName: string;
  participant1PhotoURL?: string;
  
  participant2Id: string;
  participant2DisplayName: string;
  participant2PhotoURL?: string;
  
  // ========================================
  // 💬 DERNIER MESSAGE (dénormalisé)
  // ========================================
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: Timestamp;
    isRead: boolean;
  };
  
  // ========================================
  // 📊 COMPTEURS
  // ========================================
  unreadCount: {
    [userId: string]: number;
  };
  
  totalMessagesCount: number;
  
  // ========================================
  // ✍️ TYPING INDICATOR (NOUVEAU - ÉTAPE 2)
  // ========================================
  typing?: {
    [userId: string]: Timestamp;  // Dernière activité de frappe par utilisateur
  };
  
  // ========================================
  // 📅 MÉTADONNÉES
  // ========================================
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 📝 DTO pour créer un message
 */
export interface CreateMessageDto {
  conversationId: string;
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string;
  text: string;
  type?: 'text' | 'image' | 'system';
  imageUrl?: string;
}

/**
 * 📝 DTO pour créer une conversation
 */
export interface CreateConversationDto {
  participant1Id: string;
  participant1DisplayName: string;
  participant1PhotoURL?: string;
  participant2Id: string;
  participant2DisplayName: string;
  participant2PhotoURL?: string;
}

/**
 * 📋 Interface pour afficher une conversation dans une liste
 */
export interface ConversationListItem {
  conversationId: string;
  friendId: string;
  friendDisplayName: string;
  friendPhotoURL?: string;
  lastMessageText: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline?: boolean;
}

/**
 * 📊 Interface pour les statistiques de messagerie
 */
export interface MessageStats {
  totalConversations: number;
  unreadConversations: number;
  totalUnreadMessages: number;
  lastMessageAt?: Date;
}

/**
 * ✅ Helper : Génère un ID de conversation unique
 */
export function generateConversationId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

/**
 * ✅ Helper : Extrait l'ID de l'ami dans une conversation
 */
export function getFriendIdFromConversation(
  conversation: Conversation,
  currentUserId: string
): string {
  return conversation.participant1Id === currentUserId
    ? conversation.participant2Id
    : conversation.participant1Id;
}

/**
 * ✅ Helper : Extrait les données de l'ami dans une conversation
 */
export function getFriendDataFromConversation(
  conversation: Conversation,
  currentUserId: string
): {
  displayName: string;
  photoURL?: string;
} {
  return conversation.participant1Id === currentUserId
    ? {
        displayName: conversation.participant2DisplayName,
        photoURL: conversation.participant2PhotoURL
      }
    : {
        displayName: conversation.participant1DisplayName,
        photoURL: conversation.participant1PhotoURL
      };
}

/**
 * ✅ Helper : Formate le temps écoulé pour l'affichage d'un message
 */
export function formatMessageTime(timestamp: Timestamp): string {
  const messageDate = timestamp.toDate();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  if (messageDate >= today) {
    return messageDate.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  if (messageDate >= yesterday) {
    return 'Hier';
  }

  if (messageDate >= lastWeek) {
    return messageDate.toLocaleDateString('fr-FR', { weekday: 'short' });
  }

  return messageDate.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit' 
  });
}

/**
 * ✅ Helper : Tronque le texte d'un message
 */
export function truncateMessage(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * ✅ NOUVEAU (ÉTAPE 2) : Helper pour vérifier si un utilisateur est en train d'écrire
 * Retourne true si le timestamp de typing est < 3 secondes
 */
export function isUserTyping(conversation: Conversation, userId: string): boolean {
  if (!conversation.typing || !conversation.typing[userId]) {
    return false;
  }

  const typingTimestamp = conversation.typing[userId].toDate();
  const now = new Date();
  const diffSeconds = (now.getTime() - typingTimestamp.getTime()) / 1000;

  // Considérer comme "en train d'écrire" si < 3 secondes
  return diffSeconds < 3;
}

/**
 * 📅 NOUVEAU : Type pour les éléments affichés (message ou séparateur de date)
 */
export type ChatItem = MessageItem | DateSeparatorItem;

export interface MessageItem {
  type: 'message';
  message: Message;
  isGroupStart: boolean;  // Premier message d'un groupe
  isGroupEnd: boolean;    // Dernier message d'un groupe
  showTime: boolean;      // Afficher l'heure (seulement sur le dernier du groupe)
}

export interface DateSeparatorItem {
  type: 'date-separator';
  date: Date;
  label: string;  // "Aujourd'hui", "Hier", "Lundi 28 Oct"
}

/**
 * 📅 Helper : Formate un séparateur de date
 */
export function formatDateSeparator(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (messageDate.getTime() === today.getTime()) {
    return "Aujourd'hui";
  }
  
  if (messageDate.getTime() === yesterday.getTime()) {
    return "Hier";
  }
  
  // Format : "Lundi 28 Oct"
  return date.toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'short' 
  });
}

/**
 * 📅 Helper : Vérifie si deux messages sont du même jour
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * 📦 Helper : Transforme des messages en ChatItems avec séparateurs et groupement
 */
export function transformMessagesToChatItems(
  messages: Message[], 
  currentUserId: string
): ChatItem[] {
  if (messages.length === 0) return [];
  
  // ✅ CORRECTION : Filtrer les messages sans createdAt (en cours d'envoi)
  const validMessages = messages.filter(msg => msg.createdAt != null);
  
  if (validMessages.length === 0) return [];
  
  const items: ChatItem[] = [];
  let currentDate: Date | null = null;
  
  validMessages.forEach((message, index) => {
    const messageDate = message.createdAt.toDate();
    
    // Ajouter un séparateur de date si nécessaire
    if (!currentDate || !isSameDay(currentDate, messageDate)) {
      items.push({
        type: 'date-separator',
        date: messageDate,
        label: formatDateSeparator(messageDate)
      });
      currentDate = messageDate;
    }
    
    // Vérifier si ce message doit être groupé avec le précédent
    const prevMessage = validMessages[index - 1];
    const nextMessage = validMessages[index + 1];
    
    const isGroupStart = !prevMessage || 
                         prevMessage.senderId !== message.senderId ||
                         !isSameDay(prevMessage.createdAt.toDate(), messageDate);
    
    const isGroupEnd = !nextMessage || 
                       nextMessage.senderId !== message.senderId ||
                       !isSameDay(nextMessage.createdAt.toDate(), messageDate);
    
    items.push({
      type: 'message',
      message,
      isGroupStart,
      isGroupEnd,
      showTime: true  // Afficher l'heure seulement sur le dernier du groupe
    });
  });
  
  return items;
}