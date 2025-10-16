import { Timestamp } from '@angular/fire/firestore';

export interface Message {
  id?: string;                    // ID du message
  chatId: string;                 // ID de la conversation
  senderId: string;               // ID de l'expéditeur
  senderName: string;             // Nom de l'expéditeur (dénormalisé)
  senderPhoto: string;            // Photo de l'expéditeur (dénormalisé)
  content: string;                // Contenu du message
  type: MessageType;              // Type de message
  imageUrl?: string;              // URL de l'image (si type IMAGE)
  createdAt: Timestamp;           // Date d'envoi
  readBy: string[];               // IDs des utilisateurs ayant lu le message
}

// Types de messages
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system'               // Messages système (ex: "X a rejoint")
}

// Conversation de chat
export interface Chat {
  id?: string;                    // ID de la conversation
  eventId: string;                // ID de l'événement associé
  eventTitle: string;             // Titre de l'événement (dénormalisé)
  participants: string[];         // IDs des participants
  lastMessage: string;            // Dernier message envoyé
  lastMessageAt: Timestamp;       // Date du dernier message
  createdAt: Timestamp;           // Date de création du chat
  unreadCount: { [userId: string]: number }; // Nombre de messages non lus par utilisateur
}