// src/app/features/events/event-detail/segments/participants-segment/participants-segment.component.ts
// Version simplifiée - Les modaux se rechargent automatiquement

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonCard, IonCardContent, IonButton, IonIcon, IonSpinner, IonAvatar, IonBadge,
  IonList, IonItem, IonLabel, IonSearchbar, AlertController,
  ModalController, ToastController, LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, personAddOutline, mailOutline, checkmarkCircleOutline,
  timeOutline, searchOutline, sendOutline, closeCircleOutline
} from 'ionicons/icons';
import { Subject, takeUntil, take } from 'rxjs';

import { EventWithConditionalLocation } from '../../../../../core/models/event.model';
import { Participant, ParticipantStatus } from '../../../../../core/models/participant.model';
import { EventInvitation } from '../../../../../core/models/invitation.model';
import { ParticipantsService } from '../../../../../core/services/participants.service';
import { InvitationsService } from '../../../../../core/services/invitations.service';
import { PendingRequestsModalComponent } from '../../../../../shared/components/pending-requests-modal/pending-requests-modal.component';
import { InviteFriendsModalComponent } from '../../../../../shared/components/invite-friends-modal/invite-friends-modal.component';
import { AddressDisplayInfo, EventPermissions } from 'src/app/core/models/event-permissions.model';

@Component({
  selector: 'app-participants-segment',
  templateUrl: './participants-segment.component.html',
  styleUrls: ['./participants-segment.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, IonCard, IonCardContent, IonButton, IonIcon, IonSpinner, 
    IonAvatar, IonBadge, IonList, IonItem, IonLabel, IonSearchbar
  ]
})
export class ParticipantsSegmentComponent implements OnInit, OnDestroy {
  @Input() eventId!: string;
  @Input() event!: EventWithConditionalLocation;
  @Output() participantCountChanged = new EventEmitter<number>();

  @Input() permissions!: EventPermissions;
  @Input() isReadOnly = false;

  private readonly participantsService = inject(ParticipantsService);
  private readonly invitationsService = inject(InvitationsService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly cdr = inject(ChangeDetectorRef);

  participants: Participant[] = [];
  filteredParticipants: Participant[] = [];
  pendingCount = 0;
  
  pendingInvitations: EventInvitation[] = [];
  invitationsCount = 0;
  
  isLoading = true;
  searchTerm = '';

  private destroy$ = new Subject<void>();

  constructor() {
    addIcons({
      peopleOutline, personAddOutline, mailOutline, checkmarkCircleOutline,
      timeOutline, searchOutline, sendOutline, closeCircleOutline
    });
  }

  ngOnInit() {
    console.log('👥 ParticipantsSegment initialized');
    this.loadParticipants();
    
    if (this.permissions?.canManageRequests && !this.isReadOnly) {
      if (this.event.requiresApproval) {
        this.loadPendingCount();
      }
      this.loadPendingInvitations();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadParticipants() {
    this.isLoading = true;
    
    this.participantsService.getParticipants(this.eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (participants) => {
          this.participants = participants.filter(p => p.status === ParticipantStatus.APPROVED);
          this.filteredParticipants = [...this.participants];
          this.isLoading = false;
          this.participantCountChanged.emit(this.participants.length);
          this.cdr.markForCheck();
          console.log(`✅ ${this.participants.length} participants chargés`);
        },
        error: (error) => {
          console.error('❌ Erreur chargement participants:', error);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadPendingCount() {
    this.participantsService.getPendingParticipants(this.eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pending) => {
          this.pendingCount = pending.length;
          this.cdr.markForCheck();
        },
        error: (error) => console.error('❌ Erreur compteur pending:', error)
      });
  }

  loadPendingInvitations() {
    this.invitationsService.getEventInvitations(this.eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (invitations) => {
          this.pendingInvitations = invitations.filter(inv => inv.status === 'pending');
          this.invitationsCount = this.pendingInvitations.length;
          this.cdr.markForCheck();
          console.log(`📨 ${this.invitationsCount} invitations en attente`);
        },
        error: (error) => console.error('❌ Erreur chargement invitations:', error)
      });
  }

filterParticipants(event?: any) {
  const term = this.searchTerm.toLowerCase();
  this.filteredParticipants = this.participants.filter(participant => {
    const name = participant.userName.toLowerCase();
    const email = participant.userEmail.toLowerCase();
    return name.includes(term) || email.includes(term);
  });
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

  async inviteFriends() {
    if (!this.event) return;

    const currentParticipantIds = this.participants.map(p => p.userId);

    // ✅ Chaque appel crée une NOUVELLE instance du modal
    // donc ngOnInit() se déclenchera et rechargera les données fraîches
    const modal = await this.modalCtrl.create({
      component: InviteFriendsModalComponent,
      componentProps: {
        event: this.event,
        currentParticipants: currentParticipantIds
      },
      breakpoints: [0, 0.5, 0.75, 1],
      initialBreakpoint: 0.75
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    
    if (data?.invitationsSent > 0) {
      this.showToast(`${data.invitationsSent} invitation(s) envoyée(s) !`, 'success');
      // Pas besoin de recharger, c'est déjà en temps réel
    }
  }

  async cancelInvitation(invitation: EventInvitation) {
    if (!invitation.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Annuler l\'invitation',
      message: `Voulez-vous annuler l'invitation envoyée à ${invitation.invitedUserName} ?`,
      buttons: [
        {
          text: 'Non',
          role: 'cancel'
        },
        {
          text: 'Oui, annuler',
          role: 'destructive',
          handler: () => {
            this.confirmCancelInvitation(invitation.id!);
          }
        }
      ]
    });

    await alert.present();
  }

  private async confirmCancelInvitation(invitationId: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Annulation en cours...'
    });
    await loading.present();

    this.invitationsService.deleteInvitation(invitationId).subscribe({
      next: async () => {
        await loading.dismiss();
        this.showToast('Invitation annulée', 'success');
        
        // ✅ Pas besoin de refresh manuel :
        // - loadPendingInvitations() écoute déjà en temps réel
        // - Le prochain modal ouvert sera une nouvelle instance avec données fraîches
        
        console.log('✅ Invitation supprimée - le prochain modal aura les données à jour');
      },
      error: async (error) => {
        await loading.dismiss();
        console.error('❌ Erreur annulation invitation:', error);
        this.showToast('Erreur lors de l\'annulation', 'danger');
      }
    });
  }

  async removeParticipant(participant: Participant) {
    if (!this.permissions?.canManageParticipants || !participant.id) return;
    
    // ✅ SÉCURITÉ : Empêcher la suppression de l'organisateur
    if (participant.userId === this.event.organizerId) {
      this.showToast('L\'organisateur ne peut pas être retiré de l\'événement', 'warning');
      return;
    }
    
    const alert = await this.alertCtrl.create({
      header: 'Retirer le participant',
      message: `Êtes-vous sûr de vouloir retirer ${participant.userName} de l'événement ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Retirer',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Retrait en cours...'
            });
            await loading.present();
            
            try {
              await this.participantsService.removeParticipantByOrganizer(
                this.eventId, 
                participant.id!,
                participant.userId
              ).pipe(take(1)).toPromise();
              
              await loading.dismiss();
              this.showToast(`${participant.userName} a été retiré`, 'success');
            } catch (error) {
              await loading.dismiss();
              console.error('❌ Erreur retrait participant:', error);
              this.showToast('Erreur lors du retrait', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

      // Getters pour les permissions
    get canManageRequests(): boolean {
      return this.permissions?.canManageRequests && !this.isReadOnly;
    }

    get canInviteFriends(): boolean {
      return this.permissions?.canInviteFriends && !this.isReadOnly;
    }

    get canManageParticipants(): boolean {
      return this.permissions?.canManageParticipants && !this.isReadOnly;
    }

    trackById(index: number, participant: Participant): string {
      return participant.id || index.toString();
    }

    trackByInvitationId(index: number, invitation: EventInvitation): string {
      return invitation.id || index.toString();
    }

    isOrganizer(participant: Participant): boolean {
      return participant.userId === this.event.organizerId;
    }
}