import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  informationCircleOutline, notificationsOutline } from 'ionicons/icons';

import { NotificationsService } from '../../../core/services/notifications.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import {
  Notification,
  getNotificationTimeAgo
} from '../../../core/models/notification.model';
import { Subscription } from 'rxjs';

/**
 * 🔔 NOTIFICATIONS PAGE
 * Affiche toutes les notifications de l'utilisateur
 * Permet de marquer comme lu, supprimer, et naviguer vers les entités liées
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
  private readonly alertCtrl = inject(AlertController);
  private readonly router = inject(Router);

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
    addIcons({arrowBackOutline,checkmarkDoneOutline,trashOutline,notificationsOutline,personAddOutline,peopleOutline,calendarOutline,checkmarkCircleOutline,closeCircleOutline,createOutline,alarmOutline,chatbubbleOutline,informationCircleOutline});
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

  /**
   * 📋 Charge toutes les notifications (temps réel)
   */
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
      },
      error: (error) => {
        console.error('❌ Erreur chargement notifications:', error);
        this.isLoading.set(false);
      }
    });
    this.subscriptions.push(notificationsSub);

    // Écoute le compteur de non-lus
    const unreadSub = this.notificationsService.getUnreadCount(userId).subscribe({
      next: (count) => {
        this.unreadCount.set(count);
        console.log(`📬 ${count} notifications non lues`);
      }
    });
    this.subscriptions.push(unreadSub);
  }

  // ========================================
  // ✅ ACTIONS UTILISATEUR
  // ========================================

  /**
   * 👆 Clic sur une notification
   * Marque comme lue et navigue vers l'entité liée
   */
  async onNotificationClick(notification: Notification) {
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

    // Navigation vers l'entité liée
    if (notification.actionUrl) {
      console.log('🧭 Navigation vers:', notification.actionUrl);
      this.router.navigateByUrl(notification.actionUrl);
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
    this.router.navigate(['/tabs/events']);
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
}