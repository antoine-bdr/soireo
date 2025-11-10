// src/app/core/models/notification.model.ts
// 🔔 Modèle de données pour les notifications
// Structure Firestore : collection "notifications"

import { Timestamp } from '@angular/fire/firestore';

/**
 * 📌 Types de notifications disponibles
 */
export enum NotificationType {
  // 👥 Notifications d'amitié
  FRIEND_REQUEST = 'friend_request',           // Nouvelle demande d'ami reçue
  FRIEND_ACCEPTED = 'friend_accepted',         // Demande d'ami acceptée
  
  // 📅 Notifications d'événements
  EVENT_INVITATION = 'event_invitation',       // Invitation à un événement
  EVENT_REQUEST_APPROVED = 'event_request_approved', // Participation approuvée
  EVENT_REQUEST_REJECTED = 'event_request_rejected', // Participation refusée
  EVENT_UPDATED = 'event_updated',             // Événement modifié
  EVENT_CANCELLED = 'event_cancelled',         // Événement annulé
  EVENT_REMINDER = 'event_reminder',           // Rappel d'événement (24h avant)
  NEW_PARTICIPANT = 'new_participant',         // Nouveau participant (pour organisateur)
  
  // 💬 Notifications de messages
  NEW_MESSAGE = 'new_message',                 // Nouveau message reçu
  
  // 🎯 Notifications système
  SYSTEM = 'system'                            // Notification système générale
}

/**
 * 🔔 Interface principale pour une notification
 * 
 * Structure Firestore :
 * - Collection : "notifications"
 * - Document ID : Auto-généré
 * - Index requis : userId + isRead + createdAt (DESC)
 */
export interface Notification {
  // ========================================
  // 🆔 IDENTIFICATION
  // ========================================
  id?: string;                        // ID Firestore du document
  
  // ========================================
  // 👤 DESTINATAIRE
  // ========================================
  userId: string;                     // UID de l'utilisateur qui reçoit la notification
  
  // ========================================
  // 📝 CONTENU
  // ========================================
  type: NotificationType;             // Type de notification
  title: string;                      // Titre de la notification (ex: "Nouvelle demande d'ami")
  message: string;                    // Message détaillé
  icon?: string;                      // Nom de l'icône Ionic (ex: "person-add-outline")
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'medium'; // Couleur du badge
  
  // ========================================
  // 🔗 RÉFÉRENCES
  // ========================================
  relatedEntityId?: string;           // ID de l'entité liée (eventId, friendshipId, messageId)
  relatedEntityType?: 'event' | 'friendship' | 'message' | 'user'; // Type d'entité
  actionUrl?: string;                 // URL de redirection au clic
  
  groupKey?: string;              // Clé pour regrouper les notifications similaires
  count?: number;                 // Nombre d'actions agrégées
  lastUpdatedAt?: Timestamp;      // Dernière mise à jour
  // Données dénormalisées pour affichage rapide
  senderUserId?: string;              // UID de l'utilisateur qui déclenche la notification
  senderDisplayName?: string;         // Nom de l'expéditeur
  senderPhotoURL?: string;            // Photo de l'expéditeur
  
  // ========================================
  // 📊 STATUT
  // ========================================
  isRead: boolean;                    // true si notification lue
  readAt?: Timestamp;                 // Date de lecture
  
  // ========================================
  // 📅 MÉTADONNÉES
  // ========================================
  createdAt: Timestamp;               // Date de création
  expiresAt?: Timestamp;              // Date d'expiration (auto-suppression)
}

/**
 * 📝 DTO pour créer une notification
 */
export interface CreateNotificationDto {
  userId: string;                     // Destinataire
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'medium';
  relatedEntityId?: string;
  relatedEntityType?: 'event' | 'friendship' | 'message' | 'user';
  actionUrl?: string;
  senderUserId?: string;
  senderDisplayName?: string;
  senderPhotoURL?: string;
  expiresAt?: Timestamp;              // Optionnel : auto-suppression après X jours
  groupKey?: string;
  count?: number;
}

/**
 * 📊 Interface pour les statistiques de notifications
 */
export interface NotificationStats {
  unreadCount: number;                // Nombre de notifications non lues
  totalCount: number;                 // Nombre total de notifications
  lastNotificationAt?: Date;          // Date de la dernière notification
}

/**
 * 🎨 Configuration d'affichage par type de notification
 * Utilisée pour générer automatiquement les icônes et couleurs
 */
export const NotificationConfig: Record<NotificationType, {
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'medium';
  defaultTitle: string;
}> = {
  [NotificationType.FRIEND_REQUEST]: {
    icon: 'person-add-outline',
    color: 'primary',
    defaultTitle: 'Nouvelle demande d\'ami'
  },
  [NotificationType.FRIEND_ACCEPTED]: {
    icon: 'people-outline',
    color: 'success',
    defaultTitle: 'Demande d\'ami acceptée'
  },
  [NotificationType.EVENT_INVITATION]: {
    icon: 'mail-outline',
    color: 'primary',
    defaultTitle: 'Invitation à un événement'
  },
  [NotificationType.EVENT_REQUEST_APPROVED]: {
    icon: 'checkmark-circle-outline',
    color: 'success',
    defaultTitle: 'Participation approuvée'
  },
  [NotificationType.EVENT_REQUEST_REJECTED]: {
    icon: 'close-circle-outline',
    color: 'danger',
    defaultTitle: 'Participation refusée'
  },
  [NotificationType.EVENT_UPDATED]: {
    icon: 'create-outline',
    color: 'warning',
    defaultTitle: 'Événement modifié'
  },
  [NotificationType.EVENT_CANCELLED]: {
    icon: 'trash-outline',
    color: 'danger',
    defaultTitle: 'Événement annulé'
  },
  [NotificationType.EVENT_REMINDER]: {
    icon: 'alarm-outline',
    color: 'warning',
    defaultTitle: 'Rappel d\'événement'
  },
  [NotificationType.NEW_PARTICIPANT]: {
    icon: 'person-add-outline',
    color: 'primary',
    defaultTitle: 'Nouveau participant'
  },
  [NotificationType.NEW_MESSAGE]: {
    icon: 'chatbubble-outline',
    color: 'primary',
    defaultTitle: 'Nouveau message'
  },
  [NotificationType.SYSTEM]: {
    icon: 'information-circle-outline',
    color: 'medium',
    defaultTitle: 'Notification système'
  }
};

/**
 * ✅ Helper : Génère une notification avec config par défaut
 */
export function createNotificationWithDefaults(
  type: NotificationType,
  userId: string,
  message: string,
  overrides?: Partial<CreateNotificationDto>
): CreateNotificationDto {
  const config = NotificationConfig[type];
  
  return {
    userId,
    type,
    title: config.defaultTitle,
    message,
    icon: config.icon,
    color: config.color,
    ...overrides
  };
}

/**
 * ✅ Helper : Formate le temps écoulé depuis la notification
 * Exemple : "Il y a 5 min", "Il y a 2h", "Hier", "Il y a 3 jours"
 */
export function getNotificationTimeAgo(createdAt: Timestamp): string {
  const now = new Date();
  const notifDate = createdAt.toDate();
  const diffMs = now.getTime() - notifDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  
  return notifDate.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'short' 
  });
}