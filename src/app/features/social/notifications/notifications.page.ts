import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonBadge,
  IonIcon,
  IonButton,
  IonButtons,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  AlertController,
  IonAvatar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  checkmarkDoneOutline,
  trashOutline,
  personAddOutline,
  peopleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  createOutline,
  alarmOutline,
  chatbubbleOutline,
  informationCircleOutline,
  notificationsOutline
} from 'ionicons/icons';

import { NotificationsService } from '../../../core/services/notifications.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { FriendsService } from '../../../core/services/friends.service';
import {
  Notification,
  getNotificationTimeAgo
} from '../../../core/models/notification.model';
import { Subscription } from 'rxjs';

/**
 * 🔔 NOTIFICATIONS PAGE
 * Affiche toutes les notifications de l'utilisateur
 * Gère les demandes d'ami directement dans la page
 */
@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
    IonIcon,
    IonButton,
    IonButtons,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonAvatar
  ]
})
export class NotificationsPage implements OnInit, OnDestroy {
  // ========================================
  // 📦 SERVICES
  // ========================================
  private readonly notificationsService = inject(NotificationsService);
  private readonly authService = inject(AuthenticationService);
  private readonly friendsService = inject(FriendsService);
  private readonly alertCtrl = inject(AlertController);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  // ========================================
  // 🎯 ÉTAT DE LA PAGE
  // ========================================
  notifications = signal<Notification[]>([]);
  isLoading = signal(true);
  unreadCount = signal(0);

  // ========================================
  // 🧹 GESTION DES SUBSCRIPTIONS
  // ========================================
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({
      arrowBackOutline,
      checkmarkDoneOutline,
      trashOutline,
      notificationsOutline,
      personAddOutline,
      peopleOutline,
      calendarOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      createOutline,
      alarmOutline,
      chatbubbleOutline,
      informationCircleOutline
    });
  }

  ngOnInit() {
    console.log('🔔 [NotificationsPage] Initialisation');
    this.loadNotifications();
  }

  ngOnDestroy() {
    console.log('🧹 [NotificationsPage] Nettoyage subscriptions');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ========================================
  // 📊 CHARGEMENT DES DONNÉES
  // ========================================

  loadNotifications() {
    this.isLoading.set(true);
    const userId = this.authService.getCurrentUserId();
  
    if (!userId) {
      console.error('❌ Utilisateur non connecté');
      this.isLoading.set(false);
      return;
    }
  
    console.log('🔔 Chargement notifications pour:', userId);
  
    // Écoute les notifications en temps réel
    const notificationsSub = this.notificationsService.getUserNotifications(userId).subscribe({
      next: (notifications) => {
        this.notifications.set(notifications);
        this.isLoading.set(false);
        console.log(`✅ ${notifications.length} notifications chargées`);
        
        // ✅ NOUVEAU: Marquer automatiquement tout comme lu
        this.notificationsService.markAllAsRead(userId).catch(error => 
          console.error('❌ Erreur marquage lecture:', error)
        );
      },
      error: (error) => {
        console.error('❌ Erreur chargement notifications:', error);
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(notificationsSub);
  
    // Reste du code inchangé...
    const unreadSub = this.notificationsService.getUnreadCount(userId).subscribe({
      next: (count) => {
        this.unreadCount.set(count);
      }
    });
    this.subscriptions.push(unreadSub);
  }

  // ========================================
  // ✅ ACTIONS UTILISATEUR
  // ========================================

  /**
   * 👆 Clic sur une notification
   * Pour FRIEND_REQUEST : navigation vers profil
   * Pour autres : marque comme lue et navigue vers actionUrl
   */
  /**
 * 👆 Clic sur une notification
 * Gère la redirection selon le type de notification
 */
  async onNotificationClick(notification: Notification, event?: Event) {
    console.log('👆 Clic notification:', notification.id);

    // Marquer comme lue si pas déjà lu
    if (!notification.isRead && notification.id) {
      try {
        await this.notificationsService.markAsRead(notification.id);
        console.log('✅ Notification marquée comme lue');
      } catch (error) {
        console.error('❌ Erreur marquage lecture:', error);
      }
    }

    // ✅ GESTION DES REDIRECTIONS PAR TYPE
    
    // 1️⃣ Demandes d'ami : redirection vers le profil
    if (notification.type === 'friend_request' && notification.senderUserId) {
      console.log('🧭 Navigation vers profil:', notification.senderUserId);
      this.router.navigate(['/social/friend-profile', notification.senderUserId]);
      return;
    }

    // 2️⃣ Notifications liées à un événement : redirection vers l'événement
    if (notification.relatedEntityType === 'event' && notification.relatedEntityId) {
      console.log('🧭 Navigation vers événement:', notification.relatedEntityId);
      this.router.navigate(['/events', notification.relatedEntityId]);
      return;
    }

    // 3️⃣ Autres notifications : utiliser l'actionUrl si disponible
    if (notification.actionUrl) {
      console.log('🧭 Navigation vers:', notification.actionUrl);
      this.router.navigateByUrl(notification.actionUrl);
      return;
    }

    // 4️⃣ Si aucune redirection définie
    console.log('ℹ️ Aucune action de navigation définie pour cette notification');
  }

  /**
   * ✅ Accepte une demande d'ami depuis une notification
   */
  async acceptFriendRequest(notification: Notification, slidingItem: IonItemSliding) {
    const userId = this.authService.getCurrentUserId();
    if (!userId || !notification.relatedEntityId) return;

    console.log('✅ Acceptation demande ami:', notification.relatedEntityId);

    try {
      await this.friendsService.acceptFriendRequest(notification.relatedEntityId, userId);
      
      slidingItem.close();
      console.log('✅ Demande acceptée et notification supprimée');
    } catch (error) {
      console.error('❌ Erreur acceptation:', error);
    }
  }

  /**
   * ❌ Refuse une demande d'ami depuis une notification
   */
  async rejectFriendRequest(notification: Notification, slidingItem: IonItemSliding) {
    if (!notification.relatedEntityId) return;

    console.log('❌ Refus demande ami:', notification.relatedEntityId);

    try {
      await this.friendsService.rejectFriendRequest(notification.relatedEntityId);
      
      // Supprimer la notification après refus
      if (notification.id) {
        await this.notificationsService.deleteNotification(notification.id);
      }
      
      slidingItem.close();
      console.log('✅ Demande refusée et notification supprimée');
    } catch (error) {
      console.error('❌ Erreur refus:', error);
    }
  }

  /**
   * ✅ Marque toutes les notifications comme lues
   */
  async markAllAsRead() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    console.log('✅ Marquage toutes notifications comme lues');

    try {
      await this.notificationsService.markAllAsRead(userId);
      console.log('✅ Toutes les notifications marquées comme lues');
    } catch (error) {
      console.error('❌ Erreur marquage toutes lectures:', error);
    }
  }

  /**
   * 🗑️ Supprime une notification
   */
  async deleteNotification(notification: Notification, slidingItem: IonItemSliding) {
    console.log('🗑️ Suppression notification:', notification.id);

    if (!notification.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Supprimer la notification',
      message: 'Voulez-vous vraiment supprimer cette notification ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
          handler: () => {
            slidingItem.close();
          }
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: async () => {
            try {
              await this.notificationsService.deleteNotification(notification.id!);
              console.log('✅ Notification supprimée');
            } catch (error) {
              console.error('❌ Erreur suppression:', error);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * 🗑️ Supprime toutes les notifications lues
   */
  async deleteReadNotifications() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    const alert = await this.alertCtrl.create({
      header: 'Nettoyer les notifications',
      message: 'Voulez-vous supprimer toutes les notifications déjà lues ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: async () => {
            try {
              await this.notificationsService.deleteReadNotifications(userId);
              console.log('✅ Notifications lues supprimées');
            } catch (error) {
              console.error('❌ Erreur suppression:', error);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * 🔄 Pull-to-refresh
   */
  handleRefresh(event: any) {
    console.log('🔄 Refresh notifications');
    
    // Les subscriptions temps réel vont se mettre à jour automatiquement
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  /**
   * 🔙 Retour arrière
   */
  goBack() {
    this.location.back();  // ✅ Retour à la page précédente
  }

  // ========================================
  // 🎨 HELPERS D'AFFICHAGE
  // ========================================

  /**
   * 🕐 Formate le temps écoulé depuis la notification
   */
  getTimeAgo(notification: Notification): string {
    return getNotificationTimeAgo(notification.createdAt);
  }

  /**
   * 🎨 Retourne la couleur du badge selon le statut lu/non-lu
   */
  getBadgeColor(notification: Notification): string {
    return notification.isRead ? 'medium' : (notification.color || 'primary');
  }

  /**
   * 📊 Retourne le nombre de notifications
   */
  getTotalCount(): number {
    return this.notifications().length;
  }

  /**
   * 📊 Vérifie s'il y a des notifications lues
   */
  hasReadNotifications(): boolean {
    return this.notifications().some(n => n.isRead);
  }

  /**
   * 🎯 TrackBy pour optimiser le rendering
   */
  trackByNotificationId(index: number, notification: Notification): string {
    return notification.id || index.toString();
  }

  /**
 * 👤 Clic sur l'avatar (pour FRIEND_REQUEST uniquement)
 */
onAvatarClick(notification: Notification, event: Event) {
  event.stopPropagation();
  if (notification.type === 'friend_request' && notification.senderUserId) {
    this.router.navigate(['/social/friend-profile', notification.senderUserId]);
  }
}

/**
 * 📝 Clic sur le titre (pour FRIEND_REQUEST uniquement)
 */
onTitleClick(notification: Notification, event: Event) {
  event.stopPropagation();
  if (notification.type === 'friend_request' && notification.senderUserId) {
    this.router.navigate(['/social/friend-profile', notification.senderUserId]);
  }
}
}