// src/app/features/social/friend-profile/friend-profile.page.ts
// 👤 Page de profil public d'un utilisateur
// Affiche les informations publiques et permet les actions d'ami

import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonAvatar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  IonChip,
  IonBadge,
  IonItem,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personAddOutline,
  personRemoveOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  locationOutline,
  calendarOutline,
  musicalNotesOutline,
  heartOutline,
  trophyOutline,
  chatbubbleOutline,
  mailOutline,
  imagesOutline
} from 'ionicons/icons';
import { Subscription } from 'rxjs';

import { UsersService } from '../../../core/services/users.service';
import { FriendsService } from '../../../core/services/friends.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { UserPublicProfile } from '../../../core/models/user.model';
import { Friendship, FriendshipStatus } from '../../../core/models/friend.model';

/**
 * 👤 Page Friend Profile
 * Affiche le profil public d'un utilisateur et gère les relations d'amitié
 */
@Component({
  selector: 'app-friend-profile',
  templateUrl: './friend-profile.page.html',
  styleUrls: ['./friend-profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonAvatar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonText,
    IonChip,
    IonBadge,
    IonItem,
    IonLabel,
    IonRefresher,
    IonRefresherContent
  ]
})
export class FriendProfilePage implements OnInit, OnDestroy {
  // ========================================
  // 📊 SIGNALS (Reactive State)
  // ========================================
  profile = signal<UserPublicProfile | null>(null);
  isLoading = signal<boolean>(true);
  friendshipStatus = signal<FriendshipStatus | null>(null);
  
  // ========================================
  // 📌 PROPRIÉTÉS
  // ========================================
  profileUserId: string = '';
  currentUserId: string | null = null;
  friendshipId: string | null = null;
  isSentByMe: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly usersService: UsersService,
    private readonly friendsService: FriendsService,
    private readonly authService: AuthenticationService,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController
  ) {
    // Enregistrement des icônes
    addIcons({
      personAddOutline,
      personRemoveOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      locationOutline,
      calendarOutline,
      musicalNotesOutline,
      heartOutline,
      trophyOutline,
      chatbubbleOutline,
      mailOutline,
      imagesOutline
    });
  }

  // ========================================
  // 🔄 CYCLE DE VIE
  // ========================================

  ngOnInit() {
    console.log('👤 [FriendProfilePage] Initialisation');
    
    // Récupérer l'ID de l'utilisateur courant
    this.currentUserId = this.authService.getCurrentUserId();
    
    if (!this.currentUserId) {
      console.error('❌ Aucun utilisateur connecté');
      this.router.navigate(['/login']);
      return;
    }

    // Récupérer l'ID du profil à afficher depuis l'URL
    this.profileUserId = this.route.snapshot.paramMap.get('userId') || '';
    
    if (!this.profileUserId) {
      console.error('❌ ID utilisateur manquant dans l\'URL');
      this.router.navigate(['/tabs/events']);
      return;
    }

    // Vérifier si l'utilisateur essaie de voir son propre profil
    if (this.profileUserId === this.currentUserId) {
      console.log('🔄 Redirection vers profil personnel');
      this.router.navigate(['/tabs/profile']);
      return;
    }

    this.loadUserProfile();
    this.loadFriendshipStatus();
  }

  ngOnDestroy() {
    console.log('🧹 [FriendProfilePage] Nettoyage');
    this.cleanupSubscriptions();
  }

  // ========================================
  // 📖 CHARGEMENT DES DONNÉES
  // ========================================

  /**
   * Charge le profil public de l'utilisateur
   */
  private loadUserProfile() {
    console.log(`📖 Chargement profil: ${this.profileUserId}`);

    const profileSub = this.usersService.getUserPublicProfile(this.profileUserId).subscribe({
      next: (profile) => {
        if (profile) {
          console.log('✅ Profil chargé:', profile.displayName);
          this.profile.set(profile);
        } else {
          console.warn('⚠️ Profil introuvable');
          this.showToast('Utilisateur introuvable', 'danger');
          this.router.navigate(['/tabs/events']);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('❌ Erreur chargement profil:', error);
        this.showToast('Erreur lors du chargement', 'danger');
        this.isLoading.set(false);
      }
    });

    this.subscriptions.push(profileSub);
  }

  /**
   * Charge le statut d'amitié avec cet utilisateur
   */
  private loadFriendshipStatus() {
    if (!this.currentUserId) return;

    console.log(`🔗 Vérification statut d'amitié avec ${this.profileUserId}`);

    // Utiliser checkExistingFriendship (via getAllFriendshipsForUser)
    const friendshipSub = this.friendsService['getAllFriendshipsForUser'](this.currentUserId).subscribe({
      next: (friendships) => {
        const friendship = friendships.find(f => 
          f.senderId === this.profileUserId || f.receiverId === this.profileUserId
        );

        if (friendship) {
          this.friendshipStatus.set(friendship.status);
          this.friendshipId = friendship.id!;
          this.isSentByMe = friendship.senderId === this.currentUserId;
          console.log(`✅ Statut amitié: ${friendship.status} (envoyée par moi: ${this.isSentByMe})`);
        } else {
          this.friendshipStatus.set(null);
          console.log('ℹ️ Aucune relation d\'amitié');
        }
      },
      error: (error) => {
        console.error('❌ Erreur vérification amitié:', error);
      }
    });

    this.subscriptions.push(friendshipSub);
  }

  // ========================================
  // 👥 ACTIONS D'AMITIÉ
  // ========================================

  /**
   * Envoie une demande d'ami
   */
  async sendFriendRequest() {
    if (!this.currentUserId) return;

    const profile = this.profile();
    if (!profile) return;

    console.log(`➕ Envoi demande ami à ${profile.displayName}`);

    try {
      const friendshipId = await this.friendsService.sendFriendRequest(
        this.currentUserId,
        this.profileUserId
      );
      
      this.friendshipStatus.set(FriendshipStatus.PENDING);
      this.friendshipId = friendshipId;
      this.isSentByMe = true;

      this.showToast(`Demande envoyée à ${profile.displayName}`, 'success');
    } catch (error: any) {
      console.error('❌ Erreur envoi demande:', error);
      this.showToast(error.message || 'Erreur lors de l\'envoi', 'danger');
    }
  }

  /**
   * Annule une demande d'ami envoyée
   */
  async cancelFriendRequest() {
    if (!this.friendshipId) return;

    const profile = this.profile();
    if (!profile) return;

    console.log(`❌ Annulation demande pour ${profile.displayName}`);

    try {
      await this.friendsService.rejectFriendRequest(this.friendshipId);
      
      this.friendshipStatus.set(null);
      this.friendshipId = null;
      this.isSentByMe = false;

      this.showToast('Demande annulée', 'medium');
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      this.showToast('Erreur lors de l\'annulation', 'danger');
    }
  }

  /**
   * Accepte une demande d'ami reçue
   */
  async acceptFriendRequest() {
    if (!this.friendshipId || !this.currentUserId) return;

    const profile = this.profile();
    if (!profile) return;

    console.log(`✅ Acceptation demande de ${profile.displayName}`);

    try {
      await this.friendsService.acceptFriendRequest(this.friendshipId, this.currentUserId);
      
      this.friendshipStatus.set(FriendshipStatus.ACCEPTED);
      this.showToast(`Vous êtes maintenant ami(e) avec ${profile.displayName}`, 'success');
    } catch (error) {
      console.error('❌ Erreur acceptation:', error);
      this.showToast('Erreur lors de l\'acceptation', 'danger');
    }
  }

  /**
   * Refuse une demande d'ami reçue
   */
  async rejectFriendRequest() {
    if (!this.friendshipId) return;

    const profile = this.profile();
    if (!profile) return;

    console.log(`❌ Refus demande de ${profile.displayName}`);

    try {
      await this.friendsService.rejectFriendRequest(this.friendshipId);
      
      this.friendshipStatus.set(null);
      this.friendshipId = null;

      this.showToast('Demande refusée', 'medium');
    } catch (error) {
      console.error('❌ Erreur refus:', error);
      this.showToast('Erreur lors du refus', 'danger');
    }
  }

  /**
   * Retire un ami (après confirmation)
   */
  async removeFriend() {
    if (!this.friendshipId) return;

    const profile = this.profile();
    if (!profile) return;

    const alert = await this.alertCtrl.create({
      header: 'Retirer cet ami ?',
      message: `Voulez-vous vraiment retirer ${profile.displayName} de vos amis ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Retirer',
          role: 'destructive',
          handler: async () => {
            try {
              await this.friendsService.removeFriend(this.friendshipId!);
              
              this.friendshipStatus.set(null);
              this.friendshipId = null;

              this.showToast('Ami retiré', 'medium');
            } catch (error) {
              console.error('❌ Erreur suppression ami:', error);
              this.showToast('Erreur lors de la suppression', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // ========================================
  // 🧭 NAVIGATION
  // ========================================

  /**
   * Rafraîchit les données (pull-to-refresh)
   */
  async handleRefresh(event: any) {
    console.log('🔄 Rafraîchissement...');
    this.loadUserProfile();
    this.loadFriendshipStatus();
    
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

/**
 * Navigue vers la messagerie avec cet utilisateur
 */
goToMessages() {
  const profile = this.profile();
  if (!profile) return;

  console.log(`💬 Navigation vers conversation avec ${profile.displayName}`);
  this.router.navigate(['/social/messages', this.profileUserId]);
}

  // ========================================
  // 🎨 UI HELPERS
  // ========================================

  /**
   * Retourne le texte du bouton d'action principal
   */
  getActionButtonText(): string {
    const status = this.friendshipStatus();
    
    if (status === FriendshipStatus.ACCEPTED) {
      return 'Ami';
    } else if (status === FriendshipStatus.PENDING && this.isSentByMe) {
      return 'Demande envoyée';
    } else if (status === FriendshipStatus.PENDING && !this.isSentByMe) {
      return 'Accepter';
    }
    return 'Ajouter ami';
  }

  /**
   * Retourne l'icône du bouton d'action
   */
  getActionButtonIcon(): string {
    const status = this.friendshipStatus();
    
    if (status === FriendshipStatus.ACCEPTED) {
      return 'checkmark-circle-outline';
    } else if (status === FriendshipStatus.PENDING) {
      return 'mail-outline';
    }
    return 'person-add-outline';
  }

  /**
   * Retourne la couleur du bouton d'action
   */
  getActionButtonColor(): string {
    const status = this.friendshipStatus();
    
    if (status === FriendshipStatus.ACCEPTED) {
      return 'success';
    } else if (status === FriendshipStatus.PENDING) {
      return 'warning';
    }
    return 'primary';
  }

  /**
   * Gère le clic sur le bouton d'action principal
   */
  onActionButtonClick() {
    const status = this.friendshipStatus();
    
    if (status === FriendshipStatus.ACCEPTED) {
      // Déjà ami → Option de retirer
      this.removeFriend();
    } else if (status === FriendshipStatus.PENDING && this.isSentByMe) {
      // Demande envoyée → Annuler
      this.cancelFriendRequest();
    } else if (status === FriendshipStatus.PENDING && !this.isSentByMe) {
      // Demande reçue → Accepter
      this.acceptFriendRequest();
    } else {
      // Pas de relation → Envoyer demande
      this.sendFriendRequest();
    }
  }

  /**
   * Retourne l'URL de la photo ou un placeholder
   */
  getPhotoUrl(photoURL?: string): string {
    return photoURL || 'assets/images/default-avatar.png';
  }

  /**
   * Formate la date de membre depuis
   */
  getMemberSince(memberSince: any): string {
    if (!memberSince) return '';
    
    const date = memberSince.toDate ? memberSince.toDate() : new Date(memberSince);
    return date.toLocaleDateString('fr-FR', { 
      month: 'long',
      year: 'numeric' 
    });
  }

  // ========================================
  // 🛠️ UTILITAIRES
  // ========================================

  /**
   * Affiche un toast
   */
  private async showToast(message: string, color: 'success' | 'danger' | 'medium' = 'medium') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  /**
   * Nettoie les subscriptions
   */
  private cleanupSubscriptions() {
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    this.subscriptions = [];
  }
}