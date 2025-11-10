import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonAvatar,
  IonLabel,
  IonCheckbox,
  IonSearchbar,
  IonBadge,
  IonSpinner,
  ModalController,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  searchOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  peopleOutline, personOutline } from 'ionicons/icons';

import { FriendsService } from '../../../core/services/friends.service';
import { InvitationsService } from '../../../core/services/invitations.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { FriendListItem } from '../../../core/models/friend.model';
import { Event } from '../../../core/models/event.model';
import { Participant } from '../../../core/models/participant.model';

/**
 * Interface pour un ami avec infos d'invitation enrichies
 */
interface FriendWithInviteStatus extends FriendListItem {
  isParticipant: boolean;      // Déjà participant à l'événement
  isInvited: boolean;           // Déjà invité (PENDING)
  isSelected: boolean;          // Sélectionné dans l'UI
  isDisabled: boolean;          // Grisé (participant ou invité)
  disabledReason?: string;      // Raison du grisage
}

@Component({
  selector: 'app-invite-friends-modal',
  templateUrl: './invite-friends-modal.component.html',
  styleUrls: ['./invite-friends-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonCheckbox,
    IonSearchbar,
    IonBadge,
    IonSpinner
  ]
})
export class InviteFriendsModalComponent implements OnInit {
  @Input() event!: Event;                    // Événement pour lequel on invite
  @Input() currentParticipants: string[] = []; // IDs des participants actuels
  
  friends: FriendWithInviteStatus[] = [];
  filteredFriends: FriendWithInviteStatus[] = [];
  searchTerm: string = '';
  
  isLoading: boolean = true;
  selectedCount: number = 0;
  
  // Filtres
  hideParticipants: boolean = true;          // Masquer amis déjà participants
  hideInvited: boolean = true;               // Masquer amis déjà invités

  /**
   * 🔢 Compte total des amis
   */
  get totalFriendsCount(): number {
    return this.friends.length;
  }

  /**
   * 🔢 Compte des amis disponibles (non participants, non invités)
   */
  get availableCount(): number {
    return this.friends.filter(f => !f.isDisabled).length;
  }

  /**
   * ✅ Vérifie si tous les amis filtrés sont sélectionnés
   */
  get allFilteredSelected(): boolean {
    const availableFiltered = this.filteredFriends.filter(f => !f.isDisabled);
    return availableFiltered.length > 0 && availableFiltered.every(f => f.isSelected);
  }

  private readonly modalCtrl = inject(ModalController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  private readonly friendsService = inject(FriendsService);
  private readonly invitationsService = inject(InvitationsService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly authService = inject(AuthenticationService);

  constructor() {
    addIcons({closeOutline,checkmarkCircleOutline,personOutline,peopleOutline,searchOutline,alertCircleOutline});
  }

  ngOnInit() {
    this.loadFriendsWithStatus();
  }

  /**
   * 📋 Charge la liste des amis avec leur statut d'invitation
   */
  async loadFriendsWithStatus() {
    this.isLoading = true;

    try {
      const currentUserId = this.authService.getCurrentUserId();
      if (!currentUserId) {
        this.showToast('Utilisateur non connecté', 'danger');
        this.isLoading = false;
        return;
      }

      // 1. Charger la liste des amis
      this.friendsService.getFriends(currentUserId).subscribe({
        next: async (friends: FriendListItem[]) => {
          // 2. Charger les invitations existantes
          const invitedUserIds = await this.getInvitedFriends();

          // 3. Enrichir chaque ami avec son statut
          this.friends = friends.map((friend: FriendListItem) => {
            const isParticipant = this.currentParticipants.includes(friend.userId);
            const isInvited = invitedUserIds.has(friend.userId);
            
            let disabledReason: string | undefined;
            if (isParticipant) {
              disabledReason = 'Déjà participant';
            } else if (isInvited) {
              disabledReason = 'Déjà invité';
            }

            return {
              ...friend,
              isParticipant,
              isInvited,
              isSelected: false,
              isDisabled: isParticipant || isInvited,
              disabledReason
            };
          });

          this.applyFilters();
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('❌ Erreur chargement amis:', error);
          this.isLoading = false;
          this.showToast('Erreur lors du chargement des amis', 'danger');
        }
      });
    } catch (error) {
      console.error('❌ Erreur:', error);
      this.isLoading = false;
    }
  }

  /**
   * 🔍 Récupère les IDs des amis déjà invités
   */
  private async getInvitedFriends(): Promise<Set<string>> {
    // ✅ Si l'événement n'existe pas encore (création), retourner Set vide
    if (!this.event || !this.event.id) {
      console.log('ℹ️ Événement non créé, aucune invitation existante');
      return new Set<string>();
    }
  
    return new Promise((resolve) => {
      this.invitationsService.getEventInvitations(this.event.id!).subscribe({
        next: (invitations) => {
          const invitedIds = new Set(
            invitations
              .filter(inv => inv.status === 'pending')
              .map(inv => inv.invitedUserId)
          );
          resolve(invitedIds);
        },
        error: (error) => {
          console.error('❌ Erreur chargement invitations:', error);
          resolve(new Set());
        }
      });
    });
  }

  /**
   * 🔍 Gère la recherche
   */
  handleSearch(event: any) {
    this.searchTerm = event.target.value?.toLowerCase() || '';
    this.applyFilters();
  }

  /**
   * 🎯 Applique tous les filtres
   */
  applyFilters() {
    let filtered = [...this.friends];

    // Filtre de recherche
    if (this.searchTerm) {
      filtered = filtered.filter(friend =>
        friend.displayName.toLowerCase().includes(this.searchTerm)
      );
    }

    // Filtre participants
    if (this.hideParticipants) {
      filtered = filtered.filter(friend => !friend.isParticipant);
    }

    // Filtre invités
    if (this.hideInvited) {
      filtered = filtered.filter(friend => !friend.isInvited);
    }

    this.filteredFriends = filtered;
  }

  /**
   * ☑️ Toggle filtre (générique)
   */
  toggleFilter(filterType: 'participants' | 'invited') {
    if (filterType === 'participants') {
      this.hideParticipants = !this.hideParticipants;
    } else {
      this.hideInvited = !this.hideInvited;
    }
    this.applyFilters();
  }

  /**
   * ✅ Vérifie si un ami peut être invité
   */
  canInviteFriend(friend: FriendWithInviteStatus): boolean {
    return !friend.isDisabled;
  }

  /**
   * 🏷️ Retourne le badge d'un ami selon son statut
   */
  getFriendBadge(friend: FriendWithInviteStatus): { text: string; color: string } | null {
    if (friend.isParticipant) {
      return { text: 'Participant', color: 'success' };
    }
    if (friend.isInvited) {
      return { text: 'Invité', color: 'warning' };
    }
    return null;
  }

  /**
   * ✅ Gère la sélection d'un ami
   */
  toggleFriendSelection(friend: FriendWithInviteStatus, event: any) {
    if (friend.isDisabled) {
      return;
    }

    friend.isSelected = event.detail.checked;
    this.updateSelectedCount();
  }

  /**
   * 🖱️ Gère le click sur un item ami (toggle sélection)
   */
  toggleFriendClick(friend: FriendWithInviteStatus) {
    if (friend.isDisabled) {
      return;
    }

    friend.isSelected = !friend.isSelected;
    this.updateSelectedCount();
  }

  /**
   * 🔢 Met à jour le compteur de sélection
   */
  updateSelectedCount() {
    this.selectedCount = this.friends.filter(f => f.isSelected).length;
  }

  /**
   * ✅ Sélectionner tout / Désélectionner tout (toggle)
   */
  selectAll() {
    const shouldSelect = !this.allFilteredSelected;
    
    this.filteredFriends.forEach(friend => {
      if (!friend.isDisabled) {
        friend.isSelected = shouldSelect;
      }
    });
    this.updateSelectedCount();
  }

  /**
   * ❌ Désélectionner tout
   */
  deselectAll() {
    this.friends.forEach(friend => {
      friend.isSelected = false;
    });
    this.updateSelectedCount();
  }

  /**
   * 📨 Envoie les invitations
   */
  async sendInvitations() {
    const selectedFriends = this.friends.filter(f => f.isSelected);
  
    if (selectedFriends.length === 0) {
      this.showToast('Veuillez sélectionner au moins un ami', 'warning');
      return;
    }
  
    // ✅ Mode création : retourner juste les amis sélectionnés
    if (!this.event || !this.event.id) {
      console.log('🎯 Mode création : retour des amis sélectionnés');
      this.returnSelectedFriends();
      return;
    }
  
    // ✅ Mode invitation classique : envoyer vraiment les invitations
    const loading = await this.loadingCtrl.create({
      message: `Envoi de ${selectedFriends.length} invitation(s)...`,
      spinner: 'crescent'
    });
    await loading.present();
  
    try {
      // Préparer les données des amis
      const friendIds = selectedFriends.map(f => f.userId);
      const friendsData = new Map(
        selectedFriends.map(f => [
          f.userId,
          {
            name: f.displayName,
            photo: f.photoURL
          }
        ])
      );
  
      // Envoyer les invitations
      const successCount = await this.invitationsService.sendInvitations(
        this.event.id!,
        this.event,
        friendIds,
        friendsData
      );
  
      await loading.dismiss();
  
      if (successCount > 0) {
        this.showToast(
          `${successCount} invitation(s) envoyée(s) avec succès !`,
          'success'
        );
        this.dismiss(successCount);
      } else {
        this.showToast('Aucune invitation envoyée', 'warning');
      }
    } catch (error) {
      await loading.dismiss();
      console.error('❌ Erreur envoi invitations:', error);
      this.showToast('Erreur lors de l\'envoi des invitations', 'danger');
    }
  }

  returnSelectedFriends() {
    const selectedFriends = this.friends
      .filter(f => f.isSelected)
      .map(f => ({
        userId: f.userId,
        displayName: f.displayName,
        photoURL: f.photoURL
      }));
  
    if (selectedFriends.length === 0) {
      this.showToast('Veuillez sélectionner au moins un ami', 'warning');
      return;
    }
  
    console.log(`✅ ${selectedFriends.length} ami(s) sélectionné(s)`);
    this.modalCtrl.dismiss({ 
      selectedFriends: selectedFriends,
      invitationsSent: 0 // Pas encore envoyées
    });
  }

  /**
   * 🚪 Ferme la modal
   */
  dismiss(invitationsSent: number = 0) {
    this.modalCtrl.dismiss({ invitationsSent });
  }

  /**
   * 🍞 Affiche un toast
   */
  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}