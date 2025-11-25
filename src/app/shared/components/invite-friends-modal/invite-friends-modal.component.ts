// src/app/shared/components/invite-friends-modal/invite-friends-modal.component.ts
// Modal d'invitation d'amis - VERSION CORRIGÉE avec vérification réelle des participants

import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
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
  peopleOutline, 
  personOutline 
} from 'ionicons/icons';

import { FriendsService } from '../../../core/services/friends.service';
import { InvitationsService } from '../../../core/services/invitations.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { FriendListItem } from '../../../core/models/friend.model';
import { Event } from '../../../core/models/event.model';
import { Participant } from '../../../core/models/participant.model';
import { Subject, Subscription, takeUntil, take, firstValueFrom } from 'rxjs';

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
export class InviteFriendsModalComponent implements OnInit, OnDestroy {
  @Input() event!: Event;                    // Événement pour lequel on invite
  @Input() currentParticipants: string[] = []; // IDs des participants actuels (DEPRECATED - on vérifie Firestore)
  
  friends: FriendWithInviteStatus[] = [];
  filteredFriends: FriendWithInviteStatus[] = [];
  searchTerm: string = '';
  
  isLoading: boolean = true;
  selectedCount: number = 0;
  
  // Filtres
  hideParticipants: boolean = true;          // Masquer amis déjà participants
  hideInvited: boolean = true;               // Masquer amis déjà invités

  private destroy$ = new Subject<void>();
  private friendsSubscription?: Subscription;

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
    console.log('📨 InviteFriendsModal init');
    this.loadFriendsWithStatus();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.friendsSubscription?.unsubscribe();
    console.log('🧹 InviteFriendsModal destroyed');
  }

  /**
   * 📋 Charge la liste des amis avec leur statut d'invitation
   * ✅ CORRIGÉ : Vérifie l'état réel des participants dans Firestore
   */
  private async loadFriendsWithStatus() {
    this.isLoading = true;

    try {
      const currentUserId = this.authService.getCurrentUserId();
      if (!currentUserId) {
        this.showToast('Utilisateur non connecté', 'danger');
        this.isLoading = false;
        return;
      }

      // 1. Charger les amis
      const friends = await firstValueFrom(
        this.friendsService.getFriends(currentUserId).pipe(take(1))
      );

      console.log(`👥 ${friends.length} amis chargés`);
      
      // 2. ✅ CORRECTION : Charger TOUS les participants existants depuis Firestore (pas juste les APPROVED)
      const actualParticipantIds = await this.getActualParticipants();
      console.log(`🎯 ${actualParticipantIds.size} participants réels détectés`);

      // 3. Charger les invitations existantes
      const invitedUserIds = await this.getInvitedFriends();
      console.log(`📨 ${invitedUserIds.size} invitations en attente`);

      // 4. Enrichir chaque ami avec son statut
      this.friends = friends.map((friend: FriendListItem) => {
        const isParticipant = actualParticipantIds.has(friend.userId);
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
      console.log(`✅ ${this.availableCount} amis disponibles pour invitation`);

    } catch (error: any) {
      console.error('❌ Erreur chargement amis:', error);
      this.isLoading = false;
      this.showToast('Erreur lors du chargement des amis', 'danger');
    }
  }

  /**
   * 🎯 Récupère les IDs de TOUS les participants actuels depuis Firestore
   * ✅ Vérifie l'état réel, pas seulement le tableau @Input currentParticipants
   */
  private async getActualParticipants(): Promise<Set<string>> {
    // Si l'événement n'existe pas encore (création), utiliser l'@Input
    if (!this.event || !this.event.id) {
      console.log('ℹ️ Mode création : utilisation de currentParticipants');
      return new Set<string>(this.currentParticipants);
    }

    try {
      // ✅ Charger TOUS les participants depuis Firestore (tous statuts)
      const allParticipants = await firstValueFrom(
        this.participantsService.getParticipants(this.event.id).pipe(take(1))
      );

      // Créer un Set avec tous les userId (quel que soit le statut)
      const participantIds = new Set(
        allParticipants.map(p => p.userId)
      );

      console.log(`🔍 Participants trouvés dans Firestore:`, Array.from(participantIds));
      return participantIds;

    } catch (error) {
      console.error('❌ Erreur chargement participants réels:', error);
      // Fallback sur l'@Input en cas d'erreur
      return new Set<string>(this.currentParticipants);
    }
  }

  /**
   * 🔍 Récupère les IDs des amis déjà invités
   * ✅ CORRIGÉ : Utilise take(1) + firstValueFrom pour données fraîches
   */
  private async getInvitedFriends(): Promise<Set<string>> {
    // ✅ Si l'événement n'existe pas encore (création), retourner Set vide
    if (!this.event || !this.event.id) {
      console.log('ℹ️ Événement non créé, aucune invitation existante');
      return new Set<string>();
    }
  
    try {
      // ✅ CORRECTION CRITIQUE : Utiliser take(1) pour avoir la PREMIÈRE valeur FRAÎCHE
      const invitations = await firstValueFrom(
        this.invitationsService.getEventInvitations(this.event.id!).pipe(take(1))
      );

      // ✅ Ne compter QUE les invitations PENDING (pas declined/accepted)
      const invitedIds = new Set(
        invitations
          .filter(inv => inv.status === 'pending')
          .map(inv => inv.invitedUserId)
      );
      
      return invitedIds;
    } catch (error) {
      console.error('❌ Erreur chargement invitations:', error);
      return new Set();
    }
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
      const friendsData = new Map<string, { name: string; photo?: string }>();
      selectedFriends.forEach(friend => {
        friendsData.set(friend.userId, {
          name: friend.displayName,
          photo: friend.photoURL
        });
      });

      // Envoyer les invitations
      const friendIds = selectedFriends.map(f => f.userId);
      const successCount = await this.invitationsService.sendInvitations(
        this.event.id!,
        this.event,
        friendIds,
        friendsData
      );

      await loading.dismiss();

      if (successCount > 0) {
        this.showToast(`${successCount} invitation(s) envoyée(s) !`, 'success');
        
        // ✅ Fermer le modal avec le nombre d'invitations envoyées
        this.modalCtrl.dismiss({
          invitationsSent: successCount
        });
      } else {
        this.showToast('Aucune invitation envoyée', 'warning');
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('❌ Erreur envoi invitations:', error);
      this.showToast(error.message || 'Erreur lors de l\'envoi des invitations', 'danger');
    }
  }

  /**
   * 🎯 Mode création : retourne les amis sélectionnés au composant parent
   */
  private returnSelectedFriends() {
    const selectedFriends = this.friends.filter(f => f.isSelected);
    this.modalCtrl.dismiss({
      selectedFriends: selectedFriends,
      mode: 'creation'
    });
  }

  /**
   * 🍞 Affiche un toast
   */
  private async showToast(message: string, color: 'success' | 'danger' | 'warning' | 'primary' = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  /**
   * 🚪 Ferme le modal
   */
  dismiss() {
    this.modalCtrl.dismiss();
  }
}