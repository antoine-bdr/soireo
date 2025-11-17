import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonChip, IonLabel, IonSpinner, IonBadge, 
  IonSegment, IonSegmentButton, IonRefresher, IonRefresherContent,
  AlertController, ToastController, LoadingController, IonHeader, IonToolbar, 
  IonButtons, IonBackButton, IonTitle, IonCard, IonCardContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, informationCircleOutline, megaphoneOutline, cameraOutline,
  personAddOutline, exitOutline, createOutline, trashOutline, checkmarkCircleOutline,
  closeCircleOutline, warningOutline, imageOutline, banOutline, mailOutline, lockClosedOutline } from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { InvitationsService } from '../../../core/services/invitations.service';
import { EventLocationVisibilityService } from '../../../core/services/event-location-visibility.service';
import { EventWithConditionalLocation, EventStatus, EventAccessType, Event } from '../../../core/models/event.model';
import { ParticipantStatus } from '../../../core/models/participant.model';
import { take, switchMap, takeUntil, map } from 'rxjs/operators';
import { Subject, of } from 'rxjs';

import { InfoSegmentComponent } from './segments/info-segment/info-segment.component';
import { AnnouncementsSegmentComponent } from './segments/announcements-segment/announcements-segment.component';
import { PhotosSegmentComponent } from './segments/photos-segment/photos-segment.component';
import { ParticipantsSegmentComponent } from './segments/participants-segment/participants-segment.component';

import { EventPermissionsService } from '../../../core/services/event-permissions.service';
import { EventPermissions, AddressDisplayInfo } from '../../../core/models/event-permissions.model';
import { EventInvitation } from 'src/app/core/models/invitation.model';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonCardContent, IonCard, 
    CommonModule, FormsModule, IonContent, IonButton, IonIcon, IonChip, IonLabel, 
    IonSpinner, IonBadge, IonSegment, IonSegmentButton, IonRefresher, IonRefresherContent,
    InfoSegmentComponent, AnnouncementsSegmentComponent, PhotosSegmentComponent, 
    ParticipantsSegmentComponent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle
  ]
})
export class EventDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthenticationService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly locationVisibilityService = inject(EventLocationVisibilityService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly permissionsService = inject(EventPermissionsService);
  private readonly invitationsService = inject(InvitationsService);

  private destroy$ = new Subject<void>();
  
  eventId = '';
  event: EventWithConditionalLocation | null = null;
  originalEvent: Event | null = null; // Garder l'event original pour joinEvent
  isLoading = true;
  isOrganizer = false;
  selectedSegment: 'info' | 'announcements' | 'photos' | 'participants' = 'info';

  isParticipating = false;
  participantCount = 0;
  participantStatus?: ParticipantStatus;
  canJoin = false;
  canJoinReason = '';
  isJoining = false;
  isLeaving = false;

  announcementCount = 0;
  photoCount = 0;

  imageLoaded = false;
  imageError = false;

  permissions: EventPermissions | null = null;
  addressDisplay: AddressDisplayInfo | null = null;

  userInvitation: EventInvitation | null = null;
  hasInvitation = false;
  isAcceptingInvitation = false;
  isDecliningInvitation = false;

  constructor() {
    addIcons({createOutline,trashOutline,checkmarkCircleOutline,peopleOutline,lockClosedOutline,mailOutline,closeCircleOutline,exitOutline,personAddOutline,warningOutline,imageOutline,banOutline,informationCircleOutline,megaphoneOutline,cameraOutline});
  }

  ngOnInit() {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.eventId = params['id'];
      if (this.eventId) {
        this.loadEventData();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEventData() {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.authService.getUser().pipe(
      take(1),
      switchMap(user => {
        const userId = user?.uid || null;
        
        return this.eventsService.getEventById(this.eventId).pipe(
          switchMap(event => {
            if (!event) {
              this.isLoading = false;
              this.cdr.markForCheck();
              return of(null);
            }
            
            this.originalEvent = event;
            this.isOrganizer = userId ? event.organizerId === userId : false;

            if (userId) {
              return this.participantsService.getParticipantDocumentRealtime(this.eventId, userId).pipe(
                switchMap(participant => {
                  this.participantStatus = participant?.status;
                  this.isParticipating = participant?.status === ParticipantStatus.APPROVED;

                  // ✅ Calculer les permissions
                  this.permissions = this.permissionsService.calculatePermissions(
                    event,
                    userId,
                    participant?.status
                  );

                  this.addressDisplay = this.permissionsService.getAddressDisplay(
                    event,
                    this.permissions.canViewFullAddress
                  );

                  this.canJoin = this.permissions.canJoinEvent;
                  this.canJoinReason = this.getCannotJoinReason();

                  // ✅ NOUVEAU : Charger le compteur de participants en temps réel
                  this.loadParticipantCount();

                  // ✅ Si INVITE_ONLY, charger l'invitation
                  if (event.accessType === EventAccessType.INVITE_ONLY && !this.isOrganizer) {
                    return this.invitationsService.getUserInvitationForEvent(this.eventId, userId).pipe(
                      map(invitation => {
                        this.userInvitation = invitation;
                        this.hasInvitation = !!invitation;
                        
                        const canViewAddress = this.permissions?.canViewFullAddress ?? false;
                        this.event = this.applyLocationVisibility(event, canViewAddress);
                        
                        return { event, participant };
                      })
                    );
                  }

                  const canViewAddress = this.permissions?.canViewFullAddress ?? false;
                  this.event = this.applyLocationVisibility(event, canViewAddress);
                  
                  return of({ event, participant });
                })
              );
            } else {
              // Utilisateur non connecté
              this.permissions = this.permissionsService.calculatePermissions(event, null);
              this.addressDisplay = this.permissionsService.getAddressDisplay(
                event,
                this.permissions.canViewFullAddress
              );
              
              // ✅ NOUVEAU : Charger le compteur même pour non-connecté
              this.loadParticipantCount();
              
              const canViewAddress = this.permissions?.canViewFullAddress ?? false;
              this.event = this.applyLocationVisibility(event, canViewAddress);
              
              return of({ event, participant: null });
            }
          }),
          takeUntil(this.destroy$)
        );
      })
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erreur chargement événement:', error);
        this.isLoading = false;
        this.showToast('Erreur de chargement', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  private loadParticipantCount() {
    this.participantsService
      .getAllParticipants(this.eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (participants) => {
          this.participantCount = participants.length;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Erreur chargement compteur participants:', error);
        }
      });
  }

  private applyLocationVisibility(event: Event, canViewFullAddress: boolean): EventWithConditionalLocation {
  if (canViewFullAddress) {
    // L'utilisateur peut voir l'adresse complète
    return event as EventWithConditionalLocation;
  } else {
    // Masquer l'adresse complète, ne garder que la ville
    return {
      ...event,
      location: {
        ...event.location,
        address: '', // Masquer l'adresse
        zipCode: '',  // Masquer le code postal
      }
    } as EventWithConditionalLocation;
  }
}

isInviteOnly(): boolean {
  if (!this.event) return false;
  
  const eventData = this.event as any;
  return eventData.accessType === EventAccessType.INVITE_ONLY || 
         eventData.accessType === 'invite_only';
}

  async refreshEvent(event?: any) {
    this.loadEventData();
    if (event) {
      setTimeout(() => event.target.complete(), 1000);
    }
  }

  async joinEvent() {
    if (this.isJoining || !this.canJoin || !this.originalEvent) return;
    
    this.isJoining = true;
    this.cdr.markForCheck();
    
    // joinEvent prend 2 paramètres : eventId et event
    this.participantsService.joinEvent(this.eventId, this.originalEvent).pipe(
      take(1),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isJoining = false;
        this.showToast('Inscription réussie!', 'success');
        this.refreshEvent();
      },
      error: error => {
        this.isJoining = false;
        this.cdr.markForCheck();
        this.showToast(error.message || 'Erreur', 'danger');
      }
    });
  }

  async leaveEvent() {
    if (this.isLeaving || !this.event) return;
    
    const alert = await this.alertCtrl.create({
      header: 'Annuler participation',
      message: 'Êtes-vous sûr?',
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui',
          handler: () => {
            this.isLeaving = true;
            this.cdr.markForCheck();
            
            this.participantsService.leaveEvent(this.eventId).pipe(
              take(1),
              takeUntil(this.destroy$)
            ).subscribe({
              next: () => {
                this.isLeaving = false;
                this.showToast('Participation annulée', 'success');
                this.refreshEvent();
              },
              error: () => {
                this.isLeaving = false;
                this.cdr.markForCheck();
                this.showToast('Erreur', 'danger');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  editEvent() {
    if (!this.permissions?.canEditEvent) return;
    this.router.navigate(['/events/edit', this.eventId]);
  }

  async deleteEvent() {
    if (!this.permissions?.canDeleteEvent) return;
    
    const alert = await this.alertCtrl.create({
      header: 'Supprimer',
      message: 'Cette action est irréversible.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.eventsService.deleteEvent(this.eventId).pipe(
              take(1),
              takeUntil(this.destroy$)
            ).subscribe({
              next: () => {
                this.showToast('Événement supprimé', 'success');
                this.router.navigate(['/tabs/events']);
              },
              error: () => this.showToast('Erreur', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  onSegmentChange(event: any) {
    this.selectedSegment = event.detail.value;
    this.cdr.markForCheck();
  }

  onParticipantCountChanged(count: number) {
    this.participantCount = count;
    this.cdr.markForCheck();
  }

  onAnnouncementCountChanged(count: number) {
    this.announcementCount = count;
    this.cdr.markForCheck();
  }

  onPhotoCountChanged(count: number) {
    this.photoCount = count;
    this.cdr.markForCheck();
  }

  onImageLoad() {
    this.imageLoaded = true;
    this.imageError = false;
    this.cdr.markForCheck();
  }

  onImageError(event: any) {
    this.imageError = true;
    this.imageLoaded = true; // Pour cacher le skeleton
    if (!event.target.src.includes('default-event.jpg')) {
      event.target.src = 'assets/default-event.jpg';
    }
    this.cdr.markForCheck();
  }

  isEventFull(): boolean {
    if (!this.event) return false;
    return this.participantCount >= this.event.maxParticipants;
  }

  private getCannotJoinReason(): string {
  if (!this.event) return 'Événement introuvable';
  if ((this.event as any).status === EventStatus.CANCELLED) return 'Événement annulé';
  if (this.isEventFull()) return 'Complet';
  if (this.participantStatus === ParticipantStatus.PENDING) return 'En attente';
  if (this.participantStatus === ParticipantStatus.REJECTED) return 'Refusé';
  
  // Parenthèses corrigées pour la priorité des opérateurs
  const eventData = this.event as any;
  const accessType = eventData.accessType || (eventData.isPrivate ? EventAccessType.PRIVATE : EventAccessType.PUBLIC);
  
  if (accessType === EventAccessType.INVITE_ONLY) return 'Sur invitation';
  if (accessType === EventAccessType.PRIVATE) return 'Événement privé';
  
  return 'Non disponible';
}

  formatDate(date: any): string {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('fr-FR');
  }

  getCategoryLabel(category: string): string {
    const labels: {[key: string]: string} = {
      'party': '🎉 Soirée',
      'concert': '🎵 Concert',
      'festival': '🎪 Festival',
      'bar': '🍺 Bar',
      'club': '💃 Club',
      'outdoor': '🌳 Extérieur',
      'private': '🔒 Privé',
      'other': '📌 Autre'
    };
    return labels[category?.toLowerCase()] || '📌 Autre';
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  async acceptInvitation() {
    if (!this.userInvitation?.id) return;
    
    this.isAcceptingInvitation = true;
    this.cdr.markForCheck();

    const loading = await this.loadingCtrl.create({
      message: 'Acceptation en cours...'
    });
    await loading.present();

    try {
      await this.invitationsService.acceptInvitation(this.userInvitation.id);
      await loading.dismiss();
      await this.showToast('Invitation acceptée ! Bienvenue 🎉', 'success');
      
      // Recharger les données pour mettre à jour le statut
      this.loadEventData();
    } catch (error: any) {
      await loading.dismiss();
      await this.showToast(error.message || 'Erreur lors de l\'acceptation', 'danger');
    } finally {
      this.isAcceptingInvitation = false;
      this.cdr.markForCheck();
    }
  }

  async declineInvitation() {
    if (!this.userInvitation?.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Refuser l\'invitation',
      message: 'Êtes-vous sûr de vouloir refuser cette invitation ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Refuser',
          role: 'destructive',
          handler: async () => {
            this.isDecliningInvitation = true;
            this.cdr.markForCheck();

            const loading = await this.loadingCtrl.create({
              message: 'Refus en cours...'
            });
            await loading.present();

            try {
              await this.invitationsService.declineInvitation(this.userInvitation!.id!);
              await loading.dismiss();
              await this.showToast('Invitation refusée', 'medium');
              
              // Rediriger vers la liste des événements
              this.router.navigate(['/tabs/events']);
            } catch (error: any) {
              await loading.dismiss();
              await this.showToast(error.message || 'Erreur lors du refus', 'danger');
            } finally {
              this.isDecliningInvitation = false;
              this.cdr.markForCheck();
            }
          }
        }
      ]
    });

    await alert.present();
  }
}