import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonAvatar,
  IonLabel,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  IonButtons,
  IonBackButton,
  IonBadge,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline,
  personAddOutline,
  personRemoveOutline,
  peopleOutline,
  mailOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline, locationOutline } from 'ionicons/icons';
import { Subscription, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

import { FriendsService } from '../../../core/services/friends.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { UserSearchResult, FriendListItem } from '../../../core/models/friend.model';

/**
 * 🔍 Page Friend Search
 * Permet de rechercher des utilisateurs et de gérer les demandes d'ami
 */
@Component({
  selector: 'app-friend-search',
  templateUrl: './friend-search.page.html',
  styleUrls: ['./friend-search.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
    IonText,
    IonButtons,
    IonBackButton,
    IonBadge,
    IonSegment,
    IonSegmentButton,
    IonRefresher,
    IonRefresherContent
  ]
})
export class FriendSearchPage implements OnInit, OnDestroy {
  // ========================================
  // 📊 SIGNALS (Reactive State)
  // ========================================
  searchResults = signal<UserSearchResult[]>([]);
  pendingRequests = signal<FriendListItem[]>([]);
  isLoading = signal<boolean>(false);
  isSearching = signal<boolean>(false);
  
  // ========================================
  // 📌 PROPRIÉTÉS
  // ========================================
  currentUserId: string | null = null;
  searchTerm: string = '';
  selectedSegment: 'search' | 'pending' = 'search';
  
  private subscriptions: Subscription[] = [];
  private searchSubject = new Subject<string>();

  constructor(
    private readonly friendsService: FriendsService,
    private readonly authService: AuthenticationService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController
  ) {
    // Enregistrement des icônes
    addIcons({searchOutline,mailOutline,peopleOutline,locationOutline,checkmarkCircleOutline,closeCircleOutline,personAddOutline,personRemoveOutline,timeOutline});
  }

  // ========================================
  // 🔄 CYCLE DE VIE
  // ========================================

  ngOnInit() {
    console.log('🔍 [FriendSearchPage] Initialisation');
    
    this.currentUserId = this.authService.getCurrentUserId();
    
    if (!this.currentUserId) {
      console.error('❌ Aucun utilisateur connecté');
      this.router.navigate(['/login']);
      return;
    }

    this.setupSearchDebounce();
    this.loadPendingRequests();
  }

  ngOnDestroy() {
    console.log('🧹 [FriendSearchPage] Nettoyage');
    this.cleanupSubscriptions();
    this.searchSubject.complete();
  }

  // ========================================
  // 🔍 RECHERCHE D'UTILISATEURS
  // ========================================

  /**
   * Configure le debounce pour la recherche (évite les requêtes excessives)
   */
  private setupSearchDebounce() {
    const searchSub = this.searchSubject.pipe(
      debounceTime(500), // Attend 500ms après la dernière frappe
      distinctUntilChanged(),
      switchMap(term => {
        if (!term || term.trim().length < 2) {
          this.searchResults.set([]);
          this.isSearching.set(false);
          return of([]);
        }

        console.log(`🔍 Recherche utilisateurs: "${term}"`);
        this.isSearching.set(true);

        return this.friendsService.searchUsers(term, this.currentUserId!, 20).pipe(
          catchError(error => {
            console.error('❌ Erreur recherche:', error);
            this.showToast('Erreur lors de la recherche', 'danger');
            this.isSearching.set(false);
            return of([]);
          })
        );
      })
    ).subscribe({
      next: (results) => {
        console.log(`✅ ${results.length} résultats trouvés`);
        this.searchResults.set(results);
        this.isSearching.set(false);
      },
      error: (error) => {
        console.error('❌ Erreur subscription recherche:', error);
        this.isSearching.set(false);
      }
    });

    this.subscriptions.push(searchSub);
  }

  /**
   * Gère le changement de recherche
   */
  onSearchChange(event: any) {
    const term = event.detail.value || '';
    this.searchTerm = term;
    this.searchSubject.next(term);
  }

  /**
   * Annule la recherche
   */
  cancelSearch() {
    this.searchTerm = '';
    this.searchResults.set([]);
    this.searchSubject.next('');
  }

  // ========================================
  // 👥 GESTION DES DEMANDES D'AMI
  // ========================================

  /**
   * Charge les demandes d'ami en attente (reçues)
   */
  private loadPendingRequests() {
    if (!this.currentUserId) return;

    console.log('📬 Chargement des demandes en attente');
    this.isLoading.set(true);

    const pendingSub = this.friendsService.getPendingReceivedRequests(this.currentUserId).subscribe({
      next: (requests) => {
        console.log(`✅ ${requests.length} demandes en attente`);
        this.pendingRequests.set(requests);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('❌ Erreur chargement demandes:', error);
        this.showToast('Erreur lors du chargement', 'danger');
        this.isLoading.set(false);
      }
    });

    this.subscriptions.push(pendingSub);
  }

  /**
   * Envoie une demande d'ami
   */
  async sendFriendRequest(user: UserSearchResult) {
    if (!this.currentUserId) return;

    console.log(`➕ Envoi demande ami à ${user.displayName}`);

    try {
      await this.friendsService.sendFriendRequest(this.currentUserId, user.userId);
      
      // Mettre à jour l'état local immédiatement
      const updatedResults = this.searchResults().map(u => 
        u.userId === user.userId 
          ? { ...u, isPendingRequest: true, isSentByMe: true }
          : u
      );
      this.searchResults.set(updatedResults);

      this.showToast(`Demande envoyée à ${user.displayName}`, 'success');
    } catch (error: any) {
      console.error('❌ Erreur envoi demande:', error);
      this.showToast(error.message || 'Erreur lors de l\'envoi', 'danger');
    }
  }

  /**
   * Annule une demande d'ami envoyée
   */
  async cancelFriendRequest(user: UserSearchResult) {
    if (!user.friendshipId) return;

    console.log(`❌ Annulation demande ami pour ${user.displayName}`);

    try {
      await this.friendsService.rejectFriendRequest(user.friendshipId);
      
      // Mettre à jour l'état local
      const updatedResults = this.searchResults().map(u => 
        u.userId === user.userId 
          ? { ...u, isPendingRequest: false, isSentByMe: false, friendshipId: undefined }
          : u
      );
      this.searchResults.set(updatedResults);

      this.showToast('Demande annulée', 'medium');
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      this.showToast('Erreur lors de l\'annulation', 'danger');
    }
  }

  /**
   * Accepte une demande d'ami reçue
   */
  async acceptRequest(request: FriendListItem) {
    if (!this.currentUserId) return;

    console.log(`✅ Acceptation demande de ${request.displayName}`);

    try {
      await this.friendsService.acceptFriendRequest(request.friendshipId, this.currentUserId);
      this.showToast(`Vous êtes maintenant ami(e) avec ${request.displayName}`, 'success');
    } catch (error) {
      console.error('❌ Erreur acceptation:', error);
      this.showToast('Erreur lors de l\'acceptation', 'danger');
    }
  }

  /**
   * Refuse une demande d'ami reçue
   */
  async rejectRequest(request: FriendListItem) {
    console.log(`❌ Refus demande de ${request.displayName}`);

    try {
      await this.friendsService.rejectFriendRequest(request.friendshipId);
      this.showToast('Demande refusée', 'medium');
    } catch (error) {
      console.error('❌ Erreur refus:', error);
      this.showToast('Erreur lors du refus', 'danger');
    }
  }

  // ========================================
  // 🧭 NAVIGATION
  // ========================================

  /**
   * Navigue vers le profil d'un utilisateur
   */
  goToUserProfile(userId: string) {
    console.log(`🧭 Navigation vers profil: ${userId}`);
    this.router.navigate(['/social/friend-profile', userId]);
  }

  /**
   * Change de segment (recherche / demandes)
   */
  onSegmentChange(event: any) {
    this.selectedSegment = event.detail.value;
    console.log('🔄 Changement segment:', this.selectedSegment);
  }

  /**
   * Rafraîchit les données (pull-to-refresh)
   */
  async handleRefresh(event: any) {
    console.log('🔄 Rafraîchissement...');
    
    if (this.selectedSegment === 'pending') {
      this.loadPendingRequests();
    } else if (this.searchTerm.length >= 2) {
      this.searchSubject.next(this.searchTerm);
    }
    
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  // ========================================
  // 🎨 UI HELPERS
  // ========================================

  /**
   * Retourne le texte du bouton d'action selon le statut
   */
  getActionButtonText(user: UserSearchResult): string {
    if (user.isFriend) return 'Ami';
    if (user.isPendingRequest && user.isSentByMe) return 'En attente';
    if (user.isPendingRequest && !user.isSentByMe) return 'Répondre';
    return 'Ajouter';
  }

  /**
   * Retourne l'icône du bouton d'action
   */
  getActionButtonIcon(user: UserSearchResult): string {
    if (user.isFriend) return 'checkmark-circle-outline';
    if (user.isPendingRequest) return 'time-outline';
    return 'person-add-outline';
  }

  /**
   * Retourne la couleur du bouton d'action
   */
  getActionButtonColor(user: UserSearchResult): string {
    if (user.isFriend) return 'success';
    if (user.isPendingRequest) return 'warning';
    return 'primary';
  }

  /**
   * Gère le clic sur le bouton d'action
   */
  onActionButtonClick(user: UserSearchResult) {
    if (user.isFriend) {
      // Déjà ami → Navigation vers profil
      this.goToUserProfile(user.userId);
    } else if (user.isPendingRequest && user.isSentByMe) {
      // Demande envoyée → Annuler
      this.cancelFriendRequest(user);
    } else if (user.isPendingRequest && !user.isSentByMe) {
      // Demande reçue → Navigation vers demandes
      this.selectedSegment = 'pending';
    } else {
      // Pas de relation → Envoyer demande
      this.sendFriendRequest(user);
    }
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

  /**
   * Retourne l'URL de la photo ou un placeholder
   */
  getPhotoUrl(photoURL?: string): string {
    return photoURL || 'assets/images/default-avatar.png';
  }
}