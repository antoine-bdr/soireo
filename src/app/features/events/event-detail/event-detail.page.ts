import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonChip, IonLabel, IonSpinner, IonBadge, 
  IonSegment, IonSegmentButton, IonRefresher, IonRefresherContent,
  AlertController, ToastController, LoadingController, ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBack, peopleOutline, informationCircleOutline, megaphoneOutline, cameraOutline,
  personAddOutline, exitOutline, createOutline, trashOutline, checkmarkCircleOutline,
  timeOutline, eyeOffOutline, globeOutline, mailOutline, lockClosedOutline, 
  closeCircleOutline, warningOutline, chevronDownCircleOutline, ellipsisVertical } from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { EventLocationVisibilityService } from '../../../core/services/event-location-visibility.service';
import { EventAnnouncementsService } from '../../../core/services/event-announcement.service';
import { EventWithConditionalLocation } from '../../../core/models/event.model';
import { ParticipantStatus } from '../../../core/models/participant.model';
import { take, switchMap, takeUntil } from 'rxjs/operators';
import { Subject, of } from 'rxjs';

import { InfoSegmentComponent } from './segments/info-segment/info-segment.component';
import { AnnouncementsSegmentComponent } from './segments/announcements-segment/announcements-segment.component';
import { PhotosSegmentComponent } from './segments/photos-segment/photos-segment.component';
import { ParticipantsSegmentComponent } from './segments/participants-segment/participants-segment.component';

import { EventPermissionsService } from '../../../core/services/event-permissions.service';
import { EventPermissions, AddressDisplayInfo } from '../../../core/models/event-permissions.model';
import { Event, EventStatus } from '../../../core/models/event.model';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // ✅ Gardé pour performance
  imports: [
    CommonModule, FormsModule, IonContent, IonButton, IonIcon, IonChip, IonLabel, 
    IonSpinner, IonBadge, IonSegment, IonSegmentButton, IonRefresher, IonRefresherContent,
    InfoSegmentComponent, AnnouncementsSegmentComponent, PhotosSegmentComponent, ParticipantsSegmentComponent
  ]
})
export class EventDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthenticationService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly locationVisibilityService = inject(EventLocationVisibilityService);
  private readonly announcementsService = inject(EventAnnouncementsService); 
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly permissionsService = inject(EventPermissionsService);

  private destroy$ = new Subject<void>();

  eventId: string = '';
  event: EventWithConditionalLocation | null = null;
  isLoading = true;
  isOrganizer = false;
  selectedSegment: 'info' | 'announcements' | 'photos' | 'participants' = 'info';

  isParticipating = false;
  participantCount = 0;
  participantStatus?: ParticipantStatus;
  canJoin = true;
  canJoinReason = '';
  isJoining = false;
  isLeaving = false;

  announcementCount = 0;
  photoCount = 0;

  permissions!: EventPermissions;
  addressDisplay!: AddressDisplayInfo;

  constructor() {
    addIcons({arrowBack,ellipsisVertical,peopleOutline,personAddOutline,timeOutline,closeCircleOutline,checkmarkCircleOutline,exitOutline,warningOutline,informationCircleOutline,megaphoneOutline,cameraOutline,createOutline,trashOutline,eyeOffOutline,globeOutline,mailOutline,lockClosedOutline,chevronDownCircleOutline});
  }

  ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.eventId) {
      this.showToast('Événement introuvable', 'danger');
      this.router.navigate(['/events']);
      return;
    }
    this.loadEvent();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEvent() {
    console.log('🔵 [1] loadEvent() - START');
    this.isLoading = true;
    const currentUserId = this.authService.getCurrentUserId();
    console.log('🔵 [2] currentUserId:', currentUserId);

    if (!currentUserId) {
      console.log('❌ [3] Pas de currentUserId - redirection login');
      this.showToast('Vous devez être connecté', 'warning');
      this.router.navigate(['/login']);
      return;
    }

    console.log('🔵 [4] Appel getEventById:', this.eventId);

    this.eventsService.getEventById(this.eventId).pipe(
      takeUntil(this.destroy$),
      switchMap((rawEvent) => {
        console.log('🔵 [5] Event reçu:', rawEvent);
        
        if (!rawEvent) {
          console.error('❌ [6] Event null');
          throw new Error('Événement introuvable');
        }
        
        this.isOrganizer = rawEvent.organizerId === currentUserId;
        console.log('🔵 [7] isOrganizer:', this.isOrganizer);
        
        console.log('🔵 [8] Appel getUserParticipationStatus');
        return this.participantsService.getUserParticipationStatus(this.eventId).pipe(
          take(1),
          switchMap((status: ParticipantStatus | undefined) => {
            console.log('🔵 [9] Participation status:', status);
            this.participantStatus = status;
            
            console.log('🔵 [10] Appel getEventWithMaskedLocation');
            return of(this.locationVisibilityService.getEventWithMaskedLocation(rawEvent, currentUserId, status));
          })
        );
      })
    ).subscribe({
      next: (eventWithLocation) => {
        console.log('✅ [11] Event final:', eventWithLocation);
        this.event = eventWithLocation;
        console.log('🔵 [12] Appel loadParticipationInfo');
        this.loadParticipationInfo();
        this.permissions = this.permissionsService.calculatePermissions(
          this.event as Event,
          currentUserId,
          this.participantStatus
        );
        this.addressDisplay = this.permissionsService.getAddressDisplay(
        this.event as Event,
        this.permissions.canViewFullAddress
        );

        console.log('🔐 Permissions calculées:', this.permissions);
        console.log('📍 Adresse display:', this.addressDisplay);
        console.log('✅ [13] isLoading = false');
        this.isLoading = false;
        this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
      },
      error: (error) => {
        console.error('❌ [ERROR] Erreur dans loadEvent:', error);
        this.showToast('Erreur lors du chargement', 'danger');
        this.isLoading = false;
        this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
        this.router.navigate(['/events']);
      },
      complete: () => {
        console.log('🔵 [14] Observable complete');
      }
    });
  }

  loadParticipationInfo() {
  console.log('🔵 [15] loadParticipationInfo - START');
  
  if (!this.event) {
    console.log('❌ [16] Pas d\'event dans loadParticipationInfo');
    return;
  }

  // Compteur participants
  console.log('🔵 [17] Subscribe getParticipantCount');
  this.participantsService.getParticipantCount(this.eventId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (count) => {
        console.log('✅ [18] Participant count:', count);
        this.participantCount = count;
        this.updateCanJoinStatus();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('❌ [19] Erreur getParticipantCount:', error);
      }
    });

  console.log('🔵 [20] Subscribe isUserParticipating');
  this.participantsService.isUserParticipating(this.eventId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (isParticipating) => {
        console.log('✅ [21] isUserParticipating:', isParticipating);
        this.isParticipating = isParticipating;
        this.updateCanJoinStatus();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('❌ [22] Erreur isUserParticipating:', error);
      }
    });

  // ✅ AJOUTER : Charger les compteurs photos et annonces
  this.loadPhotosCount();
  this.loadAnnouncementsCount();

  console.log('🔵 [23] loadParticipationInfo - END');
  this.updateCanJoinStatus();
}

// ✅ NOUVELLE MÉTHODE : Charger compteur photos
private loadPhotosCount() {
  const originalEvent = this.event as any;
  if (originalEvent?.eventPhotos && Array.isArray(originalEvent.eventPhotos)) {
    this.photoCount = originalEvent.eventPhotos.length;
    console.log('📸 Photo count:', this.photoCount);
    this.cdr.markForCheck();
  } else {
    this.photoCount = 0;
  }
}

// ✅ NOUVELLE MÉTHODE : Charger compteur annonces
private loadAnnouncementsCount() {
  // On va importer le service d'annonces
  // Import à ajouter en haut du fichier
  this.announcementsService.getEventAnnouncements(this.eventId)
    .pipe(take(1))
    .subscribe({
      next: (announcements) => {
        this.announcementCount = announcements.length;
        console.log('📢 Announcement count:', this.announcementCount);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('❌ Erreur chargement annonces:', error);
        this.announcementCount = 0;
      }
    });
}

  async refreshEvent(event: any) {
  console.log('🔄 Refresh event...');
  
  const currentUserId = this.authService.getCurrentUserId();

  if (!currentUserId) {
    event?.target?.complete();
    return;
  }

    this.eventsService.getEventById(this.eventId).pipe(
      take(1),
      switchMap((rawEvent) => {
        if (!rawEvent) throw new Error('Événement introuvable');
        this.isOrganizer = rawEvent.organizerId === currentUserId;
        return this.participantsService.getUserParticipationStatus(this.eventId).pipe(
          take(1),
          switchMap((status: ParticipantStatus | undefined) => {
            this.participantStatus = status;
            return of(this.locationVisibilityService.getEventWithMaskedLocation(rawEvent, currentUserId, status));
          })
        );
      })
    ).subscribe({
      next: (eventWithLocation) => {
        this.event = eventWithLocation;
        this.loadParticipationInfo(); // Recharge tout, y compris photos et annonces
        this.cdr.markForCheck();
        event?.target?.complete();
        this.permissions = this.permissionsService.calculatePermissions(
          this.event as Event,
          currentUserId,
          this.participantStatus
        );

        this.addressDisplay = this.permissionsService.getAddressDisplay(
          this.event as Event,
          this.permissions.canViewFullAddress
        );
        this.showToast('Événement mis à jour', 'success');
      },
      error: (error) => {
        console.error('❌ Erreur refresh:', error);
        event?.target?.complete();
        this.showToast('Erreur lors du rafraîchissement', 'danger');
      }
    });
  }

  async showOrganizerOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Options de l\'événement',
      buttons: [
        {
          text: 'Modifier l\'événement',
          icon: 'create-outline',
          handler: () => {
            this.editEvent();
          }
        },
        {
          text: 'Supprimer l\'événement',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.deleteEvent();
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


  private updateCanJoinStatus() {
    if (!this.event) {
      this.canJoin = false;
      this.canJoinReason = 'Événement introuvable';
      return;
    }

    if (this.participantCount >= this.event.maxParticipants) {
      this.canJoin = false;
      this.canJoinReason = 'Événement complet';
      return;
    }

    if (this.isParticipating) {
      this.canJoin = false;
      this.canJoinReason = 'Vous participez déjà';
      return;
    }

    if (this.isOrganizer) {
      this.canJoin = false;
      this.canJoinReason = 'Vous êtes l\'organisateur';
      return;
    }

    this.canJoin = true;
    this.canJoinReason = '';
  }

  async joinEvent() {
    if (this.isJoining || !this.event) return;
    this.isJoining = true;
    this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
    
    const loading = await this.loadingCtrl.create({ message: 'Inscription...' });
    await loading.present();

    this.participantsService.joinEvent(this.eventId, this.event as any).subscribe({
      next: async () => {
        await loading.dismiss();
        this.isJoining = false;
        const message = this.event!.requiresApproval 
          ? 'Demande envoyée ! En attente d\'approbation'
          : 'Vous participez à cet événement !';
        this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
        this.showToast(message, 'success');
      },
      error: async (error) => {
        await loading.dismiss();
        this.isJoining = false;
        this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
        this.showToast(error.message || 'Erreur lors de l\'inscription', 'danger');
      }
    });
  }

  async leaveEvent() {
    if (this.isLeaving || !this.event) return;
    const alert = await this.alertCtrl.create({
      header: 'Quitter l\'événement',
      message: 'Êtes-vous sûr de vouloir vous désinscrire ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Quitter', role: 'destructive', handler: () => this.confirmLeaveEvent() }
      ]
    });
    await alert.present();
  }

  private async confirmLeaveEvent() {
    this.isLeaving = true;
    this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
    
    const loading = await this.loadingCtrl.create({ message: 'Désinscription...' });
    await loading.present();

    this.participantsService.leaveEvent(this.eventId).subscribe({
      next: async () => {
        await loading.dismiss();
        this.isLeaving = false;
        this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
        this.showToast('Vous ne participez plus à cet événement', 'success');
      },
      error: async (error) => {
        await loading.dismiss();
        this.isLeaving = false;
        this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
        this.showToast('Erreur lors de la désinscription', 'danger');
      }
    });
  }

  async cancelRequest() {
    const alert = await this.alertCtrl.create({
      header: 'Annuler la demande',
      message: 'Voulez-vous retirer votre demande de participation ?',
      buttons: [
        { text: 'Non', role: 'cancel' },
        { text: 'Oui', handler: () => this.confirmCancelRequest() }
      ]
    });
    await alert.present();
  }

  private confirmCancelRequest() {
    this.participantsService.leaveEvent(this.eventId).subscribe({
      next: () => {
        this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
        this.showToast('Demande annulée', 'success');
      },
      error: () => {
        this.showToast('Erreur lors de l\'annulation', 'danger');
      }
    });
  }

  async editEvent() {
    this.router.navigate(['/events', this.eventId, 'edit']);
  }

  async deleteEvent() {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer l\'événement',
      message: 'Cette action est irréversible. Continuer ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive', handler: () => this.confirmDeleteEvent() }
      ]
    });
    await alert.present();
  }

  private async confirmDeleteEvent() {
    const loading = await this.loadingCtrl.create({ message: 'Suppression...' });
    await loading.present();

    this.eventsService.deleteEvent(this.eventId).subscribe({
      next: async () => {
        await loading.dismiss();
        this.showToast('Événement supprimé', 'success');
        this.router.navigate(['/events']);
      },
      error: async () => {
        await loading.dismiss();
        this.showToast('Erreur lors de la suppression', 'danger');
      }
    });
  }

  onAnnouncementCountChanged(count: number) { 
    this.announcementCount = count;
    this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
  }
  
  onPhotoCountChanged(count: number) { 
    this.photoCount = count;
    this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
  }
  
  onParticipantCountChanged(count: number) { 
    this.participantCount = count;
    this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
  }

  onEventUpdated() {
    console.log('🔄 Event updated from segment, reloading...');
    this.loadEvent();
  }

  isPending(): boolean { return this.participantStatus === ParticipantStatus.PENDING; }
  isAddressMasked(): boolean { return this.event ? !this.event.canSeeFullAddress : false; }
  isEventFull(): boolean { return this.event ? this.participantCount >= this.event.maxParticipants : false; }

  getCategoryLabel(category: any): string {
    const labels: Record<string, string> = {
      'PARTY': '🎉 Soirée', 'CONCERT': '🎵 Concert', 'FESTIVAL': '🎪 Festival',
      'BAR': '🍺 Bar', 'CLUB': '💃 Club', 'OUTDOOR': '🌳 Extérieur',
      'PRIVATE': '🔒 Privé', 'OTHER': '📌 Autre'
    };
    return labels[String(category).toUpperCase()] || `📌 ${category}`;
  }

  getEventAccessType(): string {
    if (!this.event) return 'public';
    const e = this.event as any;
    if (e.isPrivate) return 'private';
    if (e.requiresApproval) return 'invitation';
    return 'public';
  }

  getAccessTypeLabel(): string {
    const type = this.getEventAccessType();
    return type === 'public' ? 'Public' : type === 'invitation' ? 'Sur invitation' : 'Privé';
  }

  getAccessTypeIcon(): string {
    const type = this.getEventAccessType();
    return type === 'public' ? 'globe-outline' : type === 'invitation' ? 'mail-outline' : 'lock-closed-outline';
  }

  getParticipantBadgeStatus(): string {
    if (this.isEventFull()) return 'danger';
    const pct = (this.participantCount / this.event!.maxParticipants) * 100;
    return pct >= 80 ? 'warning' : 'success';
  }

  goBack() { this.router.navigate(['/tabs/events']); }

  async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await toast.present();
  }

  /**
   * ✅ NOUVEAU : Peut voir section annonces
   */
  canViewAnnouncements(): boolean {
    return this.permissions?.canViewAnnouncements || false;
  }

  /**
   * ✅ NOUVEAU : Peut voir section photos
   */
  canViewPhotos(): boolean {
    return this.permissions?.canViewPhotos || false;
  }

  /**
   * ✅ NOUVEAU : Peut voir section participants
   */
  canViewParticipants(): boolean {
    return this.permissions?.canViewParticipants || false;
  }

  /**
   * ✅ NOUVEAU : Événement annulé ?
   */
  isEventCancelled(): boolean {
    return this.event?.status === EventStatus.CANCELLED;
  }

  /**
   * ✅ NOUVEAU : Mode lecture seule ?
   */
  isReadOnly(): boolean {
    if (!this.event) return false;
    return this.permissionsService.isReadOnly(this.event as Event);
  }
}