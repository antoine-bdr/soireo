import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonAvatar,
  IonSpinner,
  IonFab,
  IonFabButton,
  IonFabList,
  IonBadge,
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  AlertController,
  ToastController,
  LoadingController,
  ModalController,
  ActionSheetController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  locationOutline,
  peopleOutline,
  timeOutline,
  personOutline,
  shareOutline,
  createOutline,
  trashOutline,
  lockClosedOutline,
  checkmarkCircleOutline,
  personAddOutline,
  ellipsisVertical,
  exitOutline,
  closeCircleOutline, 
  warningOutline, 
  arrowBack, 
  documentTextOutline,
  eyeOffOutline,
  notificationsOutline,
  globeOutline,
  mailOutline,
  megaphoneOutline,
  qrCodeOutline,
  checkmarkDoneOutline,
  addCircleOutline,
  radioOutline,
  imagesOutline,
  cameraOutline, informationCircleOutline, 
  checkmarkCircle, star, chatbubbleOutline, chevronForwardOutline } from 'ionicons/icons';

import { getEventAccessType, EventAccessType } from '../../../core/helpers/event-type.helper';
import { PendingRequestsModalComponent } from '../../../shared/components/pending-requests-modal/pending-requests-modal.component';
import { PhotoGalleryModalComponent } from '../../../shared/components/photo-gallery-modal/photo-gallery-modal.component';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { EventLocationVisibilityService } from '../../../core/services/event-location-visibility.service';
import { EventStatus, EventAnnouncement, EventPhoto } from '../../../core/models/event.model';
import { EventStatusService } from '../../../core/services/event-status.service';
import { EventCheckInService } from '../../../core/services/event-checkin.service';
import { EventAnnouncementsService } from '../../../core/services/event-announcement.service';
import { StorageService } from '../../../core/services/storage.service';
import { 
  Event, 
  EventWithConditionalLocation,
  EventLocation,
  MaskedEventLocation
} from '../../../core/models/event.model';
import { Participant, ParticipantStatus } from '../../../core/models/participant.model';
import { NotificationsService } from '../../../core/services/notifications.service';
import { NotificationType } from '../../../core/models/notification.model';
import { switchMap } from 'rxjs/operators';
import { Subscription, of } from 'rxjs';

// ✅ AJOUT : Import pour la géolocalisation
import { Geolocation } from '@capacitor/geolocation';
import { Timestamp } from '@angular/fire/firestore';

import { FriendsService } from '../../../core/services/friends.service';
import { FriendshipStatus } from '../../../core/models/friend.model';
import { ParticipantsListModal } from 'src/app/shared/components/participants-list-modal/participants-list-modal.component';
import { InvitationsService } from '../../../core/services/invitations.service';
import { EventInvitation, InvitationStatus, InvitationStats } from '../../../core/models/invitation.model';
import { InviteFriendsModalComponent } from '../../../shared/components/invite-friends-modal/invite-friends-modal.component';


@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  imports: [ 
    CommonModule,
    // Header
    // Content
    IonContent,
    IonButton,
    IonIcon,
    // Cards
    IonCard,
    IonCardContent,
    // Chips & Badges
    IonChip,
    IonBadge,
    IonAvatar,
    // Lists     // ✅ Pour chaque action
    IonLabel,
    // Autres
    IonSpinner,
    IonFab,
    IonFabButton,
    IonFabList,
  ]
})
export class EventDetailPage implements OnInit, OnDestroy {
  // Injection des services
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthenticationService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly locationVisibilityService = inject(EventLocationVisibilityService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly modalCtrl = inject(ModalController);
  private readonly location = inject(Location);

  private statusService = inject(EventStatusService);
  private checkInService = inject(EventCheckInService);
  private announcementsService = inject(EventAnnouncementsService);

  private readonly storageService = inject(StorageService);
  private readonly actionSheetCtrl = inject(ActionSheetController);

  private readonly notificationsService = inject(NotificationsService);
  private readonly friendsService = inject(FriendsService);
  private readonly invitationsService = inject(InvitationsService);

  // État de la page
  eventId: string = '';
  event: EventWithConditionalLocation | null = null;
  isLoading = true;
  isOrganizer = false;
  currentUserId: string | null = null;

  // Sprint 3 : Participation
  isParticipating = false;
  participantCount = 0;
  participants: Participant[] = [];
  canJoin = false;
  canJoinReason = '';
  
  participantStatus?: ParticipantStatus;
  pendingCount = 0;

  // Nouveaux états
  hasCheckedIn = false;
  checkInCount = 0;
  announcements: EventAnnouncement[] = [];
  eventStatus: EventStatus = EventStatus.UPCOMING;
  
  // Protection contre les clics multiples
  isJoining = false;
  isLeaving = false;

  // Gestion des subscriptions pour cleanup
  private subscriptions: Subscription[] = [];

  eventTypeInfo: EventAccessType | null = null;

  // ✅ AJOUT : Enum EventStatus pour l'utiliser dans le template
  EventStatus = EventStatus;

  photoPreview: string[] = []; // Les 4 dernières photos pour l'aperçu
  hasMorePhotos: boolean = false;

  private friendshipStatuses = new Map<string, FriendshipStatus | null>();

  // ========================================
  // 📨 INVITATIONS
  // ========================================
  invitations: EventInvitation[] = [];
  invitationStats: InvitationStats | null = null;
  userInvitation: EventInvitation | null = null;  // Invitation de l'utilisateur actuel
  isInvited: boolean = false;                     // L'utilisateur est-il invité ?

  constructor() {
    addIcons({arrowBack,personAddOutline,timeOutline,closeCircleOutline,checkmarkCircleOutline,exitOutline,warningOutline,informationCircleOutline,peopleOutline,calendarOutline,checkmarkDoneOutline,checkmarkCircle,megaphoneOutline,addCircleOutline,imagesOutline,cameraOutline,personOutline,documentTextOutline,notificationsOutline,chevronForwardOutline,createOutline,trashOutline,star,chatbubbleOutline,locationOutline,ellipsisVertical,shareOutline,lockClosedOutline,eyeOffOutline,globeOutline,mailOutline,radioOutline,qrCodeOutline});
  }

  ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    
    if (!this.eventId) {
      this.showToast('Événement introuvable', 'danger');
      this.router.navigate(['/tabs/events']);
      return;
    }

    const navigation = this.router.getCurrentNavigation();
      if (navigation?.extras?.state?.['reopenParticipants']) {
        setTimeout(() => this.openParticipantsModal(), 300);
      }

    this.loadEvent();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    console.log('🧹 EventDetailPage destroyed - subscriptions cleaned');
  }

  /**
   * Charge l'événement et applique le masquage selon les permissions
   */
  loadEvent() {
    this.isLoading = true;
    const currentUserId = this.authService.getCurrentUserId();
    this.currentUserId = currentUserId;

    if (!currentUserId) {
      this.showToast('Vous devez être connecté', 'warning');
      this.router.navigate(['/login']);
      return;
    }

    const eventSub = this.eventsService.getEventById(this.eventId).pipe(
      switchMap((rawEvent) => {
        if (!rawEvent) {
          throw new Error('Événement introuvable');
        }

        // 1️⃣ Vérifier si organisateur
        const isOrganizer = rawEvent.organizerId === currentUserId;
        this.isOrganizer = isOrganizer;
        
        // ✅ Calculer le statut en temps réel
        this.eventStatus = this.statusService.calculateEventStatus(rawEvent);

        // 2️⃣ Récupérer le statut du participant
        return this.participantsService.getUserParticipationStatusRealtime(this.eventId).pipe(
          switchMap((status: ParticipantStatus | undefined) => {
            this.participantStatus = status;
            console.log('👤 Statut participant:', status || 'Non inscrit');

            // 3️⃣ Appliquer le masquage conditionnel
            const eventWithMaskedLocation = this.locationVisibilityService
              .getEventWithMaskedLocation(
                rawEvent,
                currentUserId,
                status
              );

            return of(eventWithMaskedLocation);
          })
        );
      })
    ).subscribe({
      next: (eventWithLocation) => {
        this.event = eventWithLocation;
        
        // Log pour debug
        if (eventWithLocation.canSeeFullAddress) {
          console.log('✅ Adresse visible:', eventWithLocation.location);
        } else {
          console.log('🔒 Adresse masquée:', eventWithLocation.location);
        }

        this.loadParticipationInfo();
        this.loadPhotoPreview();

        // Charger check-in et annonces
        if (this.currentUserId) {
          this.loadCheckInStatus();
          this.loadAnnouncements();
          this.loadFriendshipStatuses();
          this.loadInvitations();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur chargement événement:', error);
        this.showToast('Erreur lors du chargement', 'danger');
        this.isLoading = false;
      }
    });

    this.subscriptions.push(eventSub);
  }

  /**
   * Charge les informations de participation
   */
  loadParticipationInfo() {
    if (!this.event || !this.currentUserId) return;

    // Charger les participants
    const participantsSub = this.participantsService.getParticipants(this.eventId).subscribe({
      next: (participants: Participant[]) => {
        this.participants = participants;
        this.participantCount = participants.length;
        
        // Vérifier si l'utilisateur participe
        this.isParticipating = participants.some(p => p.userId === this.currentUserId);
        
        // Vérifier si on peut rejoindre
        this.updateCanJoinStatus();
      },
      error: (error: any) => {
        console.error('❌ Erreur chargement participants:', error);
      }
    });

    this.subscriptions.push(participantsSub);

    // Charger le nombre de demandes en attente (si organisateur)
    if (this.isOrganizer && this.event.requiresApproval) {
      this.loadPendingCount();
    }
  }

  /**
   * ✅ MODIFICATION : Vérifie si l'utilisateur peut rejoindre l'événement
   * Prend en compte le statut de l'événement
   */
  updateCanJoinStatus() {
    if (!this.event) {
      this.canJoin = false;
      this.canJoinReason = '';
      return;
    }
  
    // ✅ RÈGLE 1 : Vérifier le statut de l'événement
    if (this.eventStatus === EventStatus.CANCELLED) {
      this.canJoin = false;
      this.canJoinReason = 'Cet événement a été annulé';
      return;
    }
  
    if (this.eventStatus === EventStatus.COMPLETED) {
      this.canJoin = false;
      this.canJoinReason = 'Cet événement est terminé';
      return;
    }
  
    // ✅ Événements UPCOMING et ONGOING peuvent accepter des inscriptions
    
    // RÈGLE 2 : Événement complet
    if (this.participantCount >= this.event.maxParticipants) {
      this.canJoin = false;
      this.canJoinReason = 'Cet événement est complet';
      return;
    }
  
    // ✅ RÈGLE 2.5 : INVITE_ONLY - Seuls les invités peuvent rejoindre
    if (this.event.accessType === 'invite_only' && !this.isInvited) {
      this.canJoin = false;
      this.canJoinReason = 'Cet événement est sur invitation uniquement';
      return;
    }
  
    // RÈGLE 3 : Déjà participant
    if (this.isParticipating) {
      this.canJoin = false;
      this.canJoinReason = 'Vous participez déjà';
      return;
    }
  
    // RÈGLE 4 : Demande en attente
    if (this.isPending()) {
      this.canJoin = false;
      this.canJoinReason = 'Votre demande est en attente';
      return;
    }
  
    // RÈGLE 5 : Organisateur (déjà participant auto)
    if (this.isOrganizer) {
      this.canJoin = false;
      this.canJoinReason = 'Vous êtes l\'organisateur';
      return;
    }
  
    // ✅ Sinon, on peut rejoindre
    this.canJoin = true;
    this.canJoinReason = '';
  }

  

  /**
   * Vérifie si la participation est en attente (PENDING)
   */
  isPending(): boolean {
    return this.participantStatus === ParticipantStatus.PENDING;
  }

  /**
   * ✅ Rejoindre l'événement (si autorisé selon le statut)
   */
  canJoinEvent(): boolean {
    return this.canJoin && 
           (this.eventStatus === EventStatus.UPCOMING || 
            this.eventStatus === EventStatus.ONGOING);
  }

  /**
   * Rejoindre l'événement
   */
  async joinEvent() {
    if (!this.event || !this.currentUserId || this.isJoining || !this.canJoinEvent()) {
      return;
    }

    this.isJoining = true;

    const loading = await this.loadingCtrl.create({
      message: 'Inscription en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    this.participantsService.joinEvent(this.eventId, this.event as Event).subscribe({
      next: () => {
        loading.dismiss();
        this.isJoining = false;

        if (this.event?.requiresApproval) {
          this.showToast('Demande envoyée ! En attente d\'approbation', 'success');
        } else {
          this.showToast('Vous participez maintenant à cet événement !', 'success');
        }
      },
      error: (error) => {
        console.error('❌ Erreur inscription:', error);
        loading.dismiss();
        this.isJoining = false;
        this.showToast('Erreur lors de l\'inscription', 'danger');
      }
    });
  }

  /**
   * Annuler une demande en attente
   */
  async cancelRequest() {
    if (!this.currentUserId || this.isLeaving) return;

    const alert = await this.alertCtrl.create({
      header: 'Annuler la demande',
      message: 'Voulez-vous vraiment annuler votre demande de participation ?',
      buttons: [
        {
          text: 'Non',
          role: 'cancel'
        },
        {
          text: 'Oui, annuler',
          role: 'destructive',
          handler: () => {
            this.confirmCancelRequest();
          }
        }
      ]
    });

    await alert.present();
  }

  private confirmCancelRequest() {
    if (!this.currentUserId) return;

    this.isLeaving = true;

    this.participantsService.leaveEvent(this.eventId).subscribe({
      next: () => {
        this.isLeaving = false;
        this.showToast('Demande annulée', 'success');
      },
      error: (error) => {
        console.error('❌ Erreur annulation:', error);
        this.isLeaving = false;
        this.showToast('Erreur lors de l\'annulation', 'danger');
      }
    });
  }

  /**
   * Se désinscrire de l'événement
   */
  async leaveEvent() {
    if (!this.currentUserId || this.isLeaving) return;

    const alert = await this.alertCtrl.create({
      header: 'Se désinscrire',
      message: 'Êtes-vous sûr de vouloir vous désinscrire de cet événement ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Me désinscrire',
          role: 'destructive',
          handler: () => {
            this.confirmLeaveEvent();
          }
        }
      ]
    });

    await alert.present();
  }

  private confirmLeaveEvent() {
    if (!this.currentUserId) return;

    this.isLeaving = true;

    this.participantsService.leaveEvent(this.eventId).subscribe({
      next: () => {
        this.isLeaving = false;
        this.showToast('Vous ne participez plus à cet événement', 'success');
      },
      error: (error) => {
        console.error('❌ Erreur désinscription:', error);
        this.isLeaving = false;
        this.showToast('Erreur lors de la désinscription', 'danger');
      }
    });
  }

  /**
   * ✅ MODIFICATION : Modifier l'événement (uniquement UPCOMING ou ONGOING)
   */
  editEvent() {
    if (!this.event || !this.isOrganizer) return;

    // ✅ Vérifier le statut
    if (this.eventStatus === EventStatus.COMPLETED || 
        this.eventStatus === EventStatus.CANCELLED) {
      this.showToast('Impossible de modifier un événement terminé ou annulé', 'warning');
      return;
    }

    this.router.navigate(['/events', this.eventId, 'edit']);
  }

  /**
   * ✅ MODIFICATION : Supprimer l'événement (uniquement UPCOMING)
   */
  async deleteEvent() {
    if (!this.event || !this.isOrganizer) return;

    // ✅ Vérifier le statut
    if (this.eventStatus !== EventStatus.UPCOMING) {
      this.showToast('Vous ne pouvez supprimer qu\'un événement à venir', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Supprimer l\'événement',
      message: 'Cette action est irréversible. Tous les participants seront notifiés.',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.confirmDeleteEvent();
          }
        }
      ]
    });

    await alert.present();
  }

  private async confirmDeleteEvent() {
    const loading = await this.loadingCtrl.create({
      message: 'Suppression en cours...'
    });
    await loading.present();

    this.eventsService.deleteEvent(this.eventId).subscribe({
      next: () => {
        loading.dismiss();
        this.showToast('Événement supprimé', 'success');
        this.router.navigate(['/tabs/events']);
      },
      error: (error) => {
        console.error('❌ Erreur suppression:', error);
        loading.dismiss();
        this.showToast('Erreur lors de la suppression', 'danger');
      }
    });
  }

  // ========================================
  // ✅ NOUVELLES MÉTHODES : GESTION DES ANNONCES
  // ========================================

  /**
   * Charge les annonces de l'événement
   */
  loadAnnouncements() {
    const announcementsSub = this.announcementsService.getEventAnnouncements(this.eventId).subscribe({
      next: (announcements) => {
        this.announcements = announcements;
        console.log(`📢 ${announcements.length} annonce(s) chargée(s)`);
      },
      error: (error) => {
        console.error('❌ Erreur chargement annonces:', error);
      }
    });
    this.subscriptions.push(announcementsSub);
  }

  viewParticipantProfile(userId: string) {
    console.log('👤 Navigation vers profil:', userId);
    this.router.navigate(['/social/friend-profile', userId]);
  }
  
  /**
   * 💬 Navigue vers la conversation avec un participant
   */
  sendMessageToParticipant(userId: string) {
    console.log('💬 Navigation vers conversation:', userId);
    this.router.navigate(['/social/messages', userId]);
  }
  
  /**
   * 🗑️ Retire un participant de l'événement (organisateur seulement)
   */
  async removeParticipant(participant: Participant) {
    const alert = await this.alertCtrl.create({
      header: 'Retirer ce participant ?',
      message: `Voulez-vous vraiment retirer ${participant.userName} de l'événement ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Retirer',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Retrait en cours...'
            });
            await loading.present();
  
            this.participantsService.leaveEvent(this.eventId, participant.userId).subscribe({
              next: async () => {
                await loading.dismiss();
                this.showToast(`${participant.userName} a été retiré de l'événement`, 'success');
              },
              error: async (error) => {
                await loading.dismiss();
                console.error('❌ Erreur retrait participant:', error);
                this.showToast('Erreur lors du retrait', 'danger');
              }
            });
          }
        }
      ]
    });
  
    await alert.present();
  }
  
  /**
   * ✅ Vérifie si l'utilisateur peut envoyer un message à un participant
   * (doit être ami)
   */
  canSendMessage(userId: string): boolean {
    if (userId === this.currentUserId) return false;
    const status = this.friendshipStatuses.get(userId);
    return status === FriendshipStatus.ACCEPTED;
  }

  getPreviewParticipants(): Participant[] {
    return this.participants.slice(0, 5);
  }
  
  /**
   * 📋 Ouvre la modal avec tous les participants
   */
  async openParticipantsModal() {
    const modal = await this.modalCtrl.create({
      component: ParticipantsListModal,
      componentProps: {
        participants: this.participants,
        eventId: this.eventId,
        currentUserId: this.currentUserId,
        isOrganizer: this.isOrganizer,
        organizerId: this.event?.organizerId,
        friendshipStatuses: this.friendshipStatuses
      },
      breakpoints: [0, 0.5, 0.75, 1],
      initialBreakpoint: 0.75
    });
  
    await modal.present();
  }
  
  /**
   * 🔍 Charge les statuts d'amitié pour tous les participants
   */
  private loadFriendshipStatuses() {
    if (!this.currentUserId) return;
  
    this.friendsService['getAllFriendshipsForUser'](this.currentUserId).subscribe({
      next: (friendships) => {
        // Réinitialiser la map
        this.friendshipStatuses.clear();
  
        // Remplir la map avec les statuts
        friendships.forEach(friendship => {
          const friendId = friendship.senderId === this.currentUserId 
            ? friendship.receiverId 
            : friendship.senderId;
          this.friendshipStatuses.set(friendId, friendship.status);
        });
  
        console.log(`✅ ${this.friendshipStatuses.size} statuts d'amitié chargés`);
      },
      error: (error) => {
        console.error('❌ Erreur chargement statuts amitié:', error);
      }
    });
  }
// ========================================
// 📨 MÉTHODES INVITATIONS - À AJOUTER DANS event-detail_page.ts
// ========================================

/**
 * 📨 Charge les invitations pour l'événement
 * - Si organisateur : charge toutes les invitations + stats
 * - Si utilisateur : vérifie s'il est invité
 */
private loadInvitations() {
  if (!this.eventId) return;

  console.log('📨 [loadInvitations] Début chargement - isOrganizer:', this.isOrganizer);

  // 1. Si organisateur : charger toutes les invitations et stats
  if (this.isOrganizer) {
    // Charger la liste des invitations (TEMPS RÉEL avec onSnapshot)
    const invitationsSub = this.invitationsService.getEventInvitations(this.eventId).subscribe({
      next: (invitations) => {
        this.invitations = invitations;
        console.log(`📨 ${invitations.length} invitations chargées - Statuts:`, 
          invitations.map(i => `${i.invitedUserName}: ${i.status}`)
        );
      },
      error: (error) => {
        console.error('❌ Erreur chargement invitations:', error);
      }
    });
    this.subscriptions.push(invitationsSub);

    // Charger les stats (TEMPS RÉEL, calculées depuis les invitations)
    const statsSub = this.invitationsService.getInvitationStats(this.eventId).subscribe({
      next: (stats) => {
        this.invitationStats = stats;
        console.log('📊 Stats invitations (temps réel):', stats);
      },
      error: (error) => {
        console.error('❌ Erreur chargement stats:', error);
      }
    });
    this.subscriptions.push(statsSub);
  }

  // 2. Vérifier si l'utilisateur actuel est invité (TEMPS RÉEL)
  if (this.currentUserId) {
    const userInviteSub = this.invitationsService.hasBeenInvited(this.eventId, this.currentUserId).subscribe({
      next: (isInvited) => {
        this.isInvited = isInvited;
        console.log(`✉️ Utilisateur invité: ${isInvited}`);
        
        if (isInvited) {
          // Charger les détails de l'invitation (TEMPS RÉEL)
          this.loadUserInvitation();
        }
      },
      error: (error) => {
        console.error('❌ Erreur vérification invitation:', error);
      }
    });
    this.subscriptions.push(userInviteSub);
  }
}

/**
 * 📋 Charge les détails de l'invitation de l'utilisateur
 */
private loadUserInvitation() {
  if (!this.eventId || !this.currentUserId) return;

  // ✅ TEMPS RÉEL : onSnapshot déjà utilisé dans getEventInvitations()
  const userInviteSub = this.invitationsService.getEventInvitations(this.eventId).subscribe({
    next: (invitations) => {
      // Chercher l'invitation de l'utilisateur actuel (tous statuts)
      const myInvitation = invitations.find(
        inv => inv.invitedUserId === this.currentUserId
      );

      if (!myInvitation) {
        this.userInvitation = null;
        console.log('ℹ️ Aucune invitation pour cet utilisateur');
        return;
      }

      // Mettre à jour l'invitation
      this.userInvitation = myInvitation;
      console.log(`📨 Invitation mise à jour - Statut: ${myInvitation.status}`);

      // Si acceptée ou refusée, réinitialiser après affichage
      if (myInvitation.status === InvitationStatus.ACCEPTED) {
        console.log('✅ Invitation acceptée - Masquage du badge');
        // Laisser l'UI gérer l'affichage avec *ngIf
      } else if (myInvitation.status === InvitationStatus.DECLINED) {
        console.log('❌ Invitation refusée');
      }
    },
    error: (error) => {
      console.error('❌ Erreur chargement invitation utilisateur:', error);
    }
  });

  // ✅ CRITIQUE : Ajouter au tableau pour le cleanup
  this.subscriptions.push(userInviteSub);
}

/**
 * 📨 Ouvre le modal pour inviter des amis
 */
async openInviteFriendsModal() {
  if (!this.event) return;

  const modal = await this.modalCtrl.create({
    component: InviteFriendsModalComponent,
    componentProps: {
      event: this.event as Event,  // Cast car on n'a besoin que des métadonnées, pas de la location complète
      currentParticipants: this.participants.map(p => p.userId)
    },
    breakpoints: [0, 0.5, 0.75, 1],
    initialBreakpoint: 0.75
  });

  await modal.present();

  const { data } = await modal.onWillDismiss();
  if (data?.invitationsSent > 0) {
    console.log(`✅ ${data.invitationsSent} invitations envoyées`);
    // Les invitations se rechargeront automatiquement via les subscriptions temps réel
  }
}

/**
 * ✅ Accepte l'invitation et rejoint l'événement
 */
async acceptInvitation() {
  if (!this.userInvitation || !this.eventId) return;

  const loading = await this.loadingCtrl.create({
    message: 'Acceptation de l\'invitation...',
    spinner: 'crescent'
  });
  await loading.present();

  try {
    // ✅ Le service fait TOUT : création participant + mise à jour event + notifications
    await this.invitationsService.acceptInvitation(this.userInvitation.id!);
    
    await loading.dismiss();
    
    console.log('✅ Invitation acceptée avec succès');
    
    // Toast de succès
    const toast = await this.toastCtrl.create({
      message: 'Vous participez maintenant à cet événement ! 🎉',
      duration: 3000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();

    // Nettoyer l'état local (les subscriptions temps réel mettront à jour automatiquement)
    this.isInvited = false;
    this.userInvitation = null;
    
  } catch (error) {
    await loading.dismiss();
    console.error('❌ Erreur acceptation invitation:', error);
    
    const toast = await this.toastCtrl.create({
      message: 'Erreur lors de l\'acceptation de l\'invitation',
      duration: 2000,
      color: 'danger'
    });
    await toast.present();
  }
}

/**
 * ❌ Refuse l'invitation
 */
async declineInvitation() {
  if (!this.userInvitation) return;

  const alert = await this.alertCtrl.create({
    header: 'Refuser l\'invitation ?',
    message: 'Êtes-vous sûr de vouloir refuser cette invitation ?',
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Refuser',
        role: 'destructive',
        handler: async () => {
          const loading = await this.loadingCtrl.create({
            message: 'Refus de l\'invitation...'
          });
          await loading.present();

          try {
            await this.invitationsService.declineInvitation(this.userInvitation!.id!);
            
            await loading.dismiss();
            
            const toast = await this.toastCtrl.create({
              message: 'Invitation refusée',
              duration: 2000,
              color: 'medium'
            });
            await toast.present();

            this.isInvited = false;
            this.userInvitation = null;
          } catch (error) {
            await loading.dismiss();
            console.error('❌ Erreur refus invitation:', error);
            
            const toast = await this.toastCtrl.create({
              message: 'Erreur lors du refus',
              duration: 2000,
              color: 'danger'
            });
            await toast.present();
          }
        }
      }
    ]
  });

  await alert.present();
}

/**
 * ✅ Vérifie si peut inviter des amis
 */
canInviteFriends(): boolean {
  return this.isOrganizer && 
         this.eventStatus === EventStatus.UPCOMING &&
         !this.isLoading;
}

  /**
   * ✅ Poster une annonce (disponible selon le statut)
   * - UPCOMING : ✅ Autorisé
   * - ONGOING : ✅ Autorisé
   * - COMPLETED : ✅ Autorisé
   * - CANCELLED : ❌ Bloqué
   */
  async postAnnouncement() {
    if (!this.isOrganizer) return;

    // ✅ Bloquer si événement annulé
    if (this.eventStatus === EventStatus.CANCELLED) {
      this.showToast('Impossible de poster une annonce sur un événement annulé', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Nouvelle annonce',
      inputs: [
        {
          name: 'message',
          type: 'textarea',
          placeholder: 'Votre message...'
        }
      ],
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Publier',
          handler: (data) => {
            if (data.message && data.message.trim()) {
              this.confirmPostAnnouncement(data.message.trim());
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private confirmPostAnnouncement(message: string) {
    if (!this.currentUserId || !this.event) return;
  
    const currentUserName = this.authService.getCurrentUserDisplayName() || 'Utilisateur';
    const currentUserPhoto = this.authService.getCurrentUser()?.photoURL;
  
    // ✅ Utiliser la nouvelle méthode avec notifications
    this.eventsService.createEventAnnouncement({
      eventId: this.eventId,
      authorId: this.currentUserId,
      authorName: currentUserName,
      authorPhoto: currentUserPhoto ?? undefined,
      message: message,
      type: 'info'
    }).subscribe({
      next: () => {
        this.showToast('Annonce publiée', 'success');
      },
      error: (error) => {
        console.error('❌ Erreur publication:', error);
        this.showToast('Erreur lors de la publication', 'danger');
      }
    });
  }

  // ========================================
  // ✅ NOUVELLES MÉTHODES : GESTION DU CHECK-IN
  // ========================================

  /**
   * Charge le statut de check-in
   */
  loadCheckInStatus() {
    if (!this.currentUserId) return;

    const checkInSub = this.checkInService.hasCheckedIn(this.eventId).subscribe({
      next: (hasCheckedIn) => {
        this.hasCheckedIn = hasCheckedIn;
      },
      error: (error) => {
        console.error('❌ Erreur vérification check-in:', error);
      }
    });
    this.subscriptions.push(checkInSub);

    const countSub = this.checkInService.getCheckInCount(this.eventId).subscribe({
      next: (count) => {
        this.checkInCount = count;
      },
      error: (error) => {
        console.error('❌ Erreur comptage check-ins:', error);
      }
    });
    this.subscriptions.push(countSub);
  }

  /**
   * ✅ Effectuer un check-in (uniquement si à l'adresse ET événement ONGOING)
   */
  async doCheckIn() {
    if (!this.event || !this.isParticipating || this.hasCheckedIn) return;

    // ✅ Vérifier le statut
    if (this.eventStatus !== EventStatus.ONGOING) {
      this.showToast('Le check-in est uniquement disponible pendant l\'événement', 'warning');
      return;
    }

    // ✅ Vérifier la géolocalisation
    const canCheckIn = await this.verifyLocation();
    if (!canCheckIn) {
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Check-in en cours...'
    });
    await loading.present();

    this.checkInService.checkIn(this.eventId).subscribe({
      next: () => {
        loading.dismiss();
        this.showToast('Présence confirmée ! ✅', 'success');
        this.hasCheckedIn = true;
      },
      error: (error) => {
        console.error('❌ Erreur check-in:', error);
        loading.dismiss();
        this.showToast('Erreur lors du check-in', 'danger');
      }
    });
  }

  /**
   * ✅ Vérifie si l'utilisateur est bien à l'adresse de l'événement
   * Distance maximale autorisée : 100 mètres
   */
  private async verifyLocation(): Promise<boolean> {
    if (!this.event || !this.event.canSeeFullAddress) {
      this.showToast('Impossible de vérifier votre position', 'warning');
      return false;
    }

    try {
      // Demander la permission de géolocalisation
      const permissions = await Geolocation.checkPermissions();
      
      if (permissions.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          this.showToast('Vous devez autoriser la géolocalisation pour le check-in', 'warning');
          return false;
        }
      }

      // Obtenir la position actuelle
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      // Obtenir les coordonnées de l'événement
      const eventLocation = this.event.location as EventLocation;
      const eventLat = eventLocation.latitude;
      const eventLng = eventLocation.longitude;

      // Calculer la distance en mètres
      const distance = this.calculateDistance(userLat, userLng, eventLat, eventLng);

      console.log(`📍 Distance: ${Math.round(distance)}m`);

      // Vérifier si l'utilisateur est à moins de 100 mètres
      if (distance > 100) {
        const alert = await this.alertCtrl.create({
          header: 'Trop loin',
          message: `Vous êtes à ${Math.round(distance)}m de l'événement. Vous devez être à moins de 100m pour faire le check-in.`,
          buttons: ['OK']
        });
        await alert.present();
        return false;
      }

      return true;

    } catch (error) {
      console.error('❌ Erreur géolocalisation:', error);
      this.showToast('Impossible d\'obtenir votre position', 'danger');
      return false;
    }
  }

  /**
   * Calcule la distance entre deux points GPS en mètres (formule de Haversine)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  }

  // ========================================
  // ✅ NOUVELLES MÉTHODES : GESTION DES PHOTOS
  // ========================================

  /**
   * ✅ Ajouter des photos (disponible ONGOING et COMPLETED)
   */
  async addEventPhotos() {
    // ✅ Vérifier les permissions
    if (!this.canAddPhotos()) {
      this.showToast('Les photos peuvent être ajoutées pendant ou après l\'événement', 'warning');
      return;
    }

    // Afficher l'action sheet pour choisir la source
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Ajouter une photo',
      buttons: [
        {
          text: 'Appareil photo',
          icon: 'camera-outline',
          handler: () => {
            this.uploadEventPhoto('camera');
          }
        },
        {
          text: 'Galerie',
          icon: 'images-outline',
          handler: () => {
            this.uploadEventPhoto('gallery');
          }
        },
        {
          text: 'Annuler',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  /**
   * ✅ Upload une photo de l'événement
   */

  /**
 * âœ… Upload une photo de l'événement
 */
/**
 * ✅ Upload une photo de l'événement
 */
private async uploadEventPhoto(source: 'camera' | 'gallery') {
  if (!this.event || !this.eventId || !this.currentUserId) return;

  const loading = await this.loadingCtrl.create({
    message: 'Upload en cours...'
  });
  await loading.present();

  try {
    // Sélectionner l'image
    const blob = await this.storageService.selectImage(source);
    
    if (!blob) {
      loading.dismiss();
      this.showToast('Aucune image sélectionnée', 'warning');
      return;
    }

    // Convertir le blob en File
    const file = new File([blob], `event-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });

    // Valider l'image
    if (!this.storageService.isValidImage(file)) {
      loading.dismiss();
      this.showToast('Format d\'image invalide', 'danger');
      return;
    }

    if (!this.storageService.isValidSize(file, 5)) {
      loading.dismiss();
      this.showToast('L\'image est trop volumineuse (max 5MB)', 'danger');
      return;
    }

    // Upload vers Firebase Storage
    const imageUrl = await this.storageService.uploadImageWithAutoNamePromise(
      file,
      `events/${this.eventId}/photos`
    );

    const currentUserName = this.authService.getCurrentUserDisplayName() || 'Utilisateur';
    const currentUserPhoto = this.authService.getCurrentUser()?.photoURL;

    // ✅ Créer l'objet photo avec métadonnées
    const newPhoto: EventPhoto = {
      url: imageUrl,
      uploadedBy: this.currentUserId,
      uploadedByName: currentUserName,
      uploadedAt: Timestamp.now()
    };

    // ✅ CORRECTION : Normaliser toutes les photos existantes au nouveau format
    const currentPhotos = this.event.eventPhotos || [];
    const normalizedCurrentPhotos: EventPhoto[] = currentPhotos.map(photo => {
      // Si c'est déjà un EventPhoto
      if (typeof photo === 'object' && photo.url) {
        return photo as EventPhoto;
      }
      // Si c'est l'ancien format (string), normaliser
      return {
        url: photo as string,
        uploadedBy: this.event!.organizerId,
        uploadedByName: this.event!.organizerName,
        uploadedAt: this.event!.createdAt
      } as EventPhoto;
    });

    // Ajouter la nouvelle photo
    const updatedPhotos: EventPhoto[] = [...normalizedCurrentPhotos, newPhoto];

    // Mettre à jour l'événement
    await this.eventsService.updateEvent(this.eventId, {
      eventPhotos: updatedPhotos
    }, false).toPromise();

    // Envoyer des notifications aux autres participants
    const participantsToNotify = this.event.participants.filter(
      userId => userId !== this.currentUserId
    );
    
    if (participantsToNotify.length > 0) {
      const notificationPromises = participantsToNotify.map(userId =>
        this.notificationsService.createOrUpdateNotification({
          userId,
          type: NotificationType.SYSTEM,
          title: 'Nouvelles photos',  // ✅ Titre utilisé pour buildAggregatedMessage
          message: `${currentUserName} a ajouté une photo à "${this.event!.title}"`,
          icon: 'camera-outline',
          color: 'primary',
          relatedEntityId: this.eventId,
          relatedEntityType: 'event',
          actionUrl: `/events/${this.eventId}`,
          senderUserId: this.currentUserId ?? undefined,
          senderDisplayName: currentUserName,
          senderPhotoURL: currentUserPhoto ?? undefined,
          groupKey: `photo_${this.eventId}_${this.currentUserId}`,  // ✅ AJOUTER
          count: 1  // ✅ AJOUTER
        })
      );

      await Promise.all(notificationPromises);
      console.log(`✅ Photo ajoutée et ${participantsToNotify.length} notifications envoyées/mises à jour`);
    }

    loading.dismiss();
    this.showToast('Photo ajoutée avec succès ! 📸', 'success');

  } catch (error) {
    console.error('❌ Erreur upload photo:', error);
    loading.dismiss();
    this.showToast('Erreur lors de l\'ajout de la photo', 'danger');
  }
}

  // ========================================
  // MÉTHODES POUR GESTION DE L'ADRESSE
  // ========================================

  isAddressMasked(): boolean {
    if (!this.event) return false;
    return !this.event.canSeeFullAddress;
  }

  getAddressDisplay(): string {
    if (!this.event) return '';
    
    return this.locationVisibilityService.formatAddressForDisplay(
      this.event.location
    );
  }

  getLocationMessage(): string {
    if (!this.event || this.event.canSeeFullAddress) return '';
    
    const location = this.event.location as MaskedEventLocation;
    return location.message || '';
  }

  private getOriginalLocation(): EventLocation {
    if (!this.event) {
      throw new Error('Event not loaded');
    }

    if (this.event.canSeeFullAddress) {
      return this.event.location as EventLocation;
    }

    const masked = this.event.location as MaskedEventLocation;
    return {
      address: '',
      city: masked.city,
      zipCode: masked.zipCode || '',
      latitude: masked.approximateLatitude || 0,
      longitude: masked.approximateLongitude || 0,
      country: masked.country,
      visibility: masked.visibility
    };
  }

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'party': 'primary',
      'concert': 'secondary',
      'festival': 'tertiary',
      'bar': 'warning',
      'club': 'danger',
      'outdoor': 'success',
      'private': 'medium',
      'other': 'dark'
    };
    return colors[category] || 'medium';
  }

  isEventFull(): boolean {
    if (!this.event) return false;
    return this.participantCount >= this.event.maxParticipants;
  }

  async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  shareEvent() {
    if (!this.canShare()) {
      this.showToast('Vous ne pouvez pas partager cet événement', 'warning');
      return;
    }
    
    // TODO : Implémenter le partage réel (Share API, lien, QR code, etc.)
    this.showToast('Fonctionnalité de partage à venir', 'success');
  }

  getCategoryLabel(category: any): string {
    const categoryStr = String(category).toUpperCase();
    
    const labels: Record<string, string> = {
      'PARTY': '🎉 Soirée',
      'CONCERT': '🎵 Concert',
      'FESTIVAL': '🎪 Festival',
      'BAR': '🍺 Bar',
      'CLUB': '💃 Club',
      'OUTDOOR': '🌳 Extérieur',
      'PRIVATE': '🔒 Privé',
      'OTHER': '📌 Autre'
    };
    
    return labels[categoryStr] || `📌 ${category}`;
  }

  formatDate(dateValue: any): string {
    if (!dateValue) return 'Date inconnue';
    
    try {
      let date: Date;
      
      if (dateValue?.toDate) {
        date = dateValue.toDate();
      } 
      else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } 
      else {
        date = dateValue;
      }
      
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Erreur formatDate:', error);
      return 'Erreur de date';
    }
  }

  /**
   * Formate uniquement la date sans l'heure
   */
  formatDateOnly(dateValue: any): string {
    if (!dateValue) return 'Date inconnue';
    
    try {
      let date: Date;
      
      if (dateValue?.toDate) {
        date = dateValue.toDate();
      } 
      else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } 
      else {
        date = dateValue;
      }
      
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Erreur formatDateOnly:', error);
      return 'Erreur de date';
    }
  }

  /**
   * Formate uniquement l'heure d'un Timestamp
   */
  formatTime(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      let date: Date;
      
      if (dateValue?.toDate) {
        date = dateValue.toDate();
      } 
      else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } 
      else {
        date = dateValue;
      }
      
      if (isNaN(date.getTime())) {
        return '';
      }
      
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Erreur formatTime:', error);
      return '';
    }
  }

  /**
   * Calcule et formate la durée de l'événement
   */
  getEventDuration(): string {
    if (!this.event?.startTime || !this.event?.endTime) {
      return '';
    }

    try {
      const start = this.event.startTime.toDate();
      const end = this.event.endTime.toDate();
      const durationMs = end.getTime() - start.getTime();
      const durationHours = durationMs / (60 * 60 * 1000);

      if (durationHours < 1) {
        const minutes = Math.round((durationHours * 60));
        return `${minutes} min`;
      } else if (durationHours === Math.floor(durationHours)) {
        return `${Math.floor(durationHours)}h`;
      } else {
        const hours = Math.floor(durationHours);
        const minutes = Math.round((durationHours - hours) * 60);
        return minutes > 0 ? `${hours}h${minutes}` : `${hours}h`;
      }
    } catch (error) {
      console.error('Erreur calcul durée:', error);
      return '';
    }
  }

  getParticipantBadgeStatus(): string {
    if (this.isEventFull()) {
      return 'danger';
    }
    
    const percentage = (this.participantCount / this.event!.maxParticipants) * 100;
    
    if (percentage >= 80) {
      return 'warning';
    }
    
    return 'success';
  }

  getEventAccessType(): string {
    if (!this.event) return 'public';
    
    const originalEvent = this.event as any;
    
    if (originalEvent.isPrivate) {
      return 'private';
    }
    
    if (originalEvent.requiresApproval) {
      return 'invitation';
    }
    
    return 'public';
  }
  
  getAccessTypeLabel(): string {
    const type = this.getEventAccessType();
    
    switch (type) {
      case 'public':
        return 'Public';
      case 'invitation':
        return 'Sur invitation';
      case 'private':
        return 'Privé';
      default:
        return 'Public';
    }
  }
  
  getAccessTypeIcon(): string {
    const type = this.getEventAccessType();
    
    switch (type) {
      case 'public':
        return 'globe-outline';
      case 'invitation':
        return 'mail-outline';
      case 'private':
        return 'lock-closed-outline';
      default:
        return 'globe-outline';
    }
  }

  /**
   * ✅ Obtient les informations du badge de statut
   */
  getStatusBadge(): { label: string; color: string; icon: string } {
    return this.statusService.getStatusDisplay(this.eventStatus);
  }

  goBack() {
    // ✅ Toujours revenir à la liste des événements depuis event-detail
    this.router.navigate(['/tabs/events']);
  }

  // ========================================
  // GESTION DES DEMANDES
  // ========================================

  loadPendingCount() {
    const pendingSub = this.participantsService.getPendingParticipants(this.eventId).subscribe({
      next: (pending) => {
        this.pendingCount = pending.length;
        console.log(`🔔 ${this.pendingCount} demande(s) en attente`);
      },
      error: (error) => {
        console.error('❌ Erreur chargement demandes:', error);
      }
    });
    this.subscriptions.push(pendingSub);
  }

  async openPendingRequestsModal() {
    if (!this.event) return;

    const modal = await this.modalCtrl.create({
      component: PendingRequestsModalComponent,
      componentProps: {
        eventId: this.eventId,
        eventTitle: this.event.title
      },
      breakpoints: [0, 0.5, 0.75, 1],
      initialBreakpoint: 0.75
    });

    await modal.present();
  }

  // ========================================
  // ✅ NOUVELLES MÉTHODES : VÉRIFICATIONS DE PERMISSIONS
  // ========================================

  /**
   * Vérifie si on peut demander une participation
   */
  canRequestParticipation(): boolean {
    return this.eventStatus === EventStatus.UPCOMING || 
           this.eventStatus === EventStatus.ONGOING;
  }

  /**
   * Vérifie si on peut poster des annonces
   */
  canPostAnnouncement(): boolean {
    return this.isOrganizer && 
           this.eventStatus !== EventStatus.CANCELLED;
  }

  /**
   * Vérifie si on peut modifier l'événement
   */
  canEditEvent(): boolean {
    return this.isOrganizer && 
           (this.eventStatus === EventStatus.UPCOMING || 
            this.eventStatus === EventStatus.ONGOING);
  }

  /**
   * Vérifie si on peut supprimer l'événement
   */
  canDeleteEvent(): boolean {
    return this.isOrganizer && 
           this.eventStatus === EventStatus.UPCOMING;
  }

  /**
   * Vérifie si on peut ajouter des photos
   */
  canAddPhotos(): boolean {
    return (this.isOrganizer || this.isParticipating) &&
           (this.eventStatus === EventStatus.ONGOING || 
            this.eventStatus === EventStatus.COMPLETED);
  }

  /**
   * Vérifie si on peut faire un check-in
   */
  canDoCheckIn(): boolean {
    return this.isParticipating && 
           !this.hasCheckedIn &&
           this.eventStatus === EventStatus.ONGOING;
  }

  loadPhotoPreview() {
    if (!this.event?.eventPhotos || this.event.eventPhotos.length === 0) {
      this.photoPreview = [];
      this.hasMorePhotos = false;
      return;
    }
  
    const allPhotos = this.event.eventPhotos;
    
    // ✅ Gérer les deux formats : ancien (string[]) et nouveau (EventPhoto[])
    const photoUrls = allPhotos.slice(-4).reverse().map(photo => {
      // Si c'est déjà un objet EventPhoto
      if (typeof photo === 'object' && photo.url) {
        return photo.url;
      }
      // Si c'est l'ancien format (string)
      return photo as string;
    });
    
    this.photoPreview = photoUrls;
    this.hasMorePhotos = allPhotos.length > 4;
  }
  
  /**
   * 🖼️ Ouvre la galerie complète des photos
   */
  /**
 * ðŸ–¼ï¸ Ouvre la galerie complète des photos
 */
  /**
 * 🖼️ Ouvre la galerie complète des photos
 */
async openPhotoGallery() {
  if (!this.event?.eventPhotos || this.event.eventPhotos.length === 0) {
    this.showToast('Aucune photo disponible', 'warning');
    return;
  }

  // ✅ Normaliser les photos au nouveau format si nécessaire
  const normalizedPhotos: EventPhoto[] = this.event.eventPhotos.map((photo, index) => {
    // Si c'est déjà un objet EventPhoto
    if (typeof photo === 'object' && photo.url) {
      return photo as EventPhoto;
    }
    // Si c'est l'ancien format (string), créer un objet EventPhoto
    return {
      url: photo as string,
      uploadedBy: this.event!.organizerId, // Attribuer à l'organisateur par défaut
      uploadedByName: this.event!.organizerName,
      uploadedAt: this.event!.createdAt
    } as EventPhoto;
  });

  const modal = await this.modalCtrl.create({
    component: PhotoGalleryModalComponent,
    componentProps: {
      photos: normalizedPhotos,
      eventTitle: this.event.title,
      currentUserId: this.currentUserId,
      isOrganizer: this.isOrganizer
    }
  });

  await modal.present();

  const { data } = await modal.onWillDismiss();
  
  // Si suppression de photo
  if (data?.action === 'delete') {
    await this.deleteEventPhoto(data.photoIndex);
  }
}
    
  /**
   * 🗑️ Supprime une photo de l'événement
   */
  private async deleteEventPhoto(photoIndex: number) {
    if (!this.event?.eventPhotos) return;

    const photoItem = this.event.eventPhotos[photoIndex];
    
    // ✅ Extraire l'URL selon le format
    const photoUrl = typeof photoItem === 'object' && photoItem.url 
      ? photoItem.url 
      : photoItem as string;

    const alert = await this.alertCtrl.create({
      header: 'Supprimer la photo',
      message: 'Voulez-vous vraiment supprimer cette photo ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Suppression...'
            });
            await loading.present();

            try {
              // Supprimer du Storage
              await this.storageService.deleteImagePromise(photoUrl);

              // ✅ CORRECTION : Normaliser toutes les photos avant de filtrer
              const currentPhotos = this.event!.eventPhotos!;
              const normalizedPhotos: EventPhoto[] = currentPhotos.map(photo => {
                // Si c'est déjà un EventPhoto
                if (typeof photo === 'object' && photo.url) {
                  return photo as EventPhoto;
                }
                // Si c'est l'ancien format (string), normaliser
                return {
                  url: photo as string,
                  uploadedBy: this.event!.organizerId,
                  uploadedByName: this.event!.organizerName,
                  uploadedAt: this.event!.createdAt
                } as EventPhoto;
              });

              // Filtrer pour supprimer la photo
              const updatedPhotos: EventPhoto[] = normalizedPhotos.filter((_, index) => index !== photoIndex);

              // Mettre à jour l'événement
              await this.eventsService.updateEvent(this.eventId, {
                eventPhotos: updatedPhotos
              }, false).toPromise();
              
              // ✅ NOUVEAU : Décrémenter/supprimer la notification
              const groupKey = `photo_${this.eventId}_${this.currentUserId}`;
              const participantsToNotify = this.event!.participants.filter(
                userId => userId !== this.currentUserId
              );
              
              if (participantsToNotify.length > 0) {
                const notificationPromises = participantsToNotify.map(userId =>
                  this.notificationsService.decrementOrDeleteNotification(groupKey, userId)
                );
              
                await Promise.all(notificationPromises).catch(error => {
                  console.error('⚠️ Erreur décrémentation notifications (non bloquant):', error);
                });
              }
              
              loading.dismiss();
              this.showToast('Photo supprimée', 'success');
            } catch (error) {
              console.error('❌ Erreur suppression photo:', error);
              loading.dismiss();
              this.showToast('Erreur lors de la suppression', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  getPrimaryBadge(): { text: string, color: string } {
    // Ordre de priorité
    if (this.eventStatus === EventStatus.CANCELLED) 
      return { text: '❌ Annulé', color: 'danger' };
    if (this.isEventFull()) 
      return { text: '🔒 COMPLET', color: 'danger' };
    if (this.hasCheckedIn) 
      return { text: '✅ Présent', color: 'success' };
    if (this.isOrganizer) 
      return { text: '⭐ Organisateur', color: 'warning' };
    if (this.isParticipating) 
      return { text: '✓ Inscrit', color: 'success' };
    if (this.event?.isPrivate)  // ✅ Ajouter optional chaining
      return { text: '🔒 Privé', color: 'dark' };
    
    // ✅ Adapter la structure de getStatusBadge()
    const statusBadge = this.getStatusBadge();
    return { 
      text: statusBadge.label,  // ✅ Utiliser label au lieu de text
      color: statusBadge.color 
    };
  }
  
  getSecondaryBadge(): { text: string, color: string } | null {
    if (this.isAddressMasked()) 
      return { text: '🔒 Adresse masquée', color: 'medium' };
    return null;
  }

  canShare(): boolean {
    if (!this.event || this.eventStatus === EventStatus.CANCELLED) {
      return false;
    }
  
    // ✅ INVITE_ONLY : Pas de partage du tout (même pour les participants)
    if (this.event.accessType === 'invite_only') {
      return false;
    }
  
    // ✅ PUBLIC et PRIVÉ : Seuls les participants peuvent partager
    return this.isParticipating || this.isOrganizer;
  }
  
  /**
   * ✅ NOUVEAU : Vérifie si le FAB a au moins une action disponible
   * Le FAB ne s'affiche que s'il y a au moins une action à proposer
   */
  hasFabActions(): boolean {
    return this.canEditEvent() || this.canShare();
  }
}