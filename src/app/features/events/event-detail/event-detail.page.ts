import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonChip, IonLabel, IonSpinner, IonBadge, 
  IonSegment, IonSegmentButton, IonRefresher, IonRefresherContent,
  AlertController, ToastController, LoadingController, IonHeader, IonToolbar, 
  IonButtons, IonBackButton, IonTitle, IonCard } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, informationCircleOutline, megaphoneOutline, cameraOutline,
  personAddOutline, exitOutline, createOutline, trashOutline, checkmarkCircleOutline,
  closeCircleOutline, warningOutline, imageOutline, banOutline } from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { ParticipantsService } from '../../../core/services/participants.service';
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

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonCard, 
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

  constructor() {
    addIcons({createOutline,trashOutline,imageOutline,checkmarkCircleOutline,closeCircleOutline,banOutline,peopleOutline,personAddOutline,exitOutline,warningOutline,informationCircleOutline,megaphoneOutline,cameraOutline});
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

    // Utiliser getUser() au lieu de currentUser$
    this.authService.getUser().pipe(
      take(1),
      switchMap(user => {
        const userId = user?.uid || null;
        
        return this.eventsService.getEventById(this.eventId).pipe(
          switchMap(event => {
            if (!event) return of(null);
            
            this.originalEvent = event; // Garder l'event original
            this.isOrganizer = userId ? event.organizerId === userId : false;
            
            if (userId && !this.isOrganizer) {
              // Utiliser getParticipantDocumentOneTime
              return this.participantsService.getParticipantDocumentOneTime(this.eventId, userId).pipe(
                map(participant => ({
                  event,
                  userId,
                  participant
                }))
              );
            }
            
            return of({ event, userId, participant: null });
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: result => {
        if (!result || !result.event) {
          this.isLoading = false;
          this.cdr.markForCheck();
          return;
        }
        
        const { event, userId, participant } = result;
        
        if (participant) {
          this.isParticipating = participant.status === ParticipantStatus.APPROVED;
          this.participantStatus = participant.status;
        }
        
        // Charger le nombre de participants
        this.participantsService.getParticipantCount(this.eventId).pipe(
          take(1),
          takeUntil(this.destroy$)
        ).subscribe(count => {
          this.participantCount = count;
          this.cdr.markForCheck();
        });
        
        this.photoCount = (event as any).eventPhotos?.length || 0;
        
        this.permissions = this.permissionsService.calculatePermissions(
          event,
          userId,
          this.participantStatus
        );
        
        this.addressDisplay = this.permissionsService.getAddressDisplay(
          event,
          this.permissions.canViewFullAddress
        );
        
        this.event = this.locationVisibilityService.getEventWithMaskedLocation(
          event,
          userId || '',
          this.participantStatus
        );
        
        this.canJoin = this.permissions.canJoinEvent && !this.isEventFull();
        if (!this.canJoin && !this.isOrganizer && !this.isParticipating) {
          this.canJoinReason = this.getCannotJoinReason();
        }
        
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Erreur:', error);
        this.isLoading = false;
        this.cdr.markForCheck();
        this.showToast('Erreur lors du chargement', 'danger');
      }
    });
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
}