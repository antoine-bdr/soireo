// src/app/features/events/event-detail/components/participants-segment/participants-segment.component.ts

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonCard, IonCardContent, IonButton, IonIcon, IonSpinner, IonAvatar, IonBadge,
  IonList, IonItem, IonLabel, IonSearchbar, AlertController, // ✅ Ajouter AlertController
  ModalController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, personAddOutline, mailOutline, checkmarkCircleOutline,
  timeOutline, searchOutline, sendOutline, closeCircleOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';

import { EventWithConditionalLocation } from '../../../../../core/models/event.model';
import { Participant, ParticipantStatus } from '../../../../../core/models/participant.model';
import { EventInvitation } from '../../../../../core/models/invitation.model'; // ✅ Importer du modèle
import { ParticipantsService } from '../../../../../core/services/participants.service';
import { InvitationsService } from '../../../../../core/services/invitations.service';
import { PendingRequestsModalComponent } from '../../../../../shared/components/pending-requests-modal/pending-requests-modal.component';
import { InviteFriendsModalComponent } from '../../../../../shared/components/invite-friends-modal/invite-friends-modal.component';
import { AddressDisplayInfo, EventPermissions } from 'src/app/core/models/event-permissions.model';

// ❌ SUPPRIMER cette interface locale
// interface EventInvitation { ... }

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
  private readonly cdr = inject(ChangeDetectorRef);

  participants: Participant[] = [];
  filteredParticipants: Participant[] = [];
  pendingCount = 0;
  
  // ✅ Utiliser le type importé
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
          console.log(`👥 ${this.participants.length} participants chargés`);
        },
        error: (error) => {
          console.error('❌ Erreur chargement participants:', error);
          this.isLoading = false;
        }
      });
  }

  loadPendingCount() {
    this.participantsService.getPendingParticipants(this.eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pending) => {
          this.pendingCount = pending.length;
          console.log(`📋 ${this.pendingCount} demande(s) en attente`);
        },
        error: (error) => {
          console.error('❌ Erreur chargement demandes:', error);
        }
      });
  }

  loadPendingInvitations() {
    console.log('📧 Chargement des invitations pour l\'événement:', this.eventId);
    
    this.invitationsService.getEventInvitations(this.eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (invitations) => {
          console.log('📧 Invitations reçues:', invitations);
          this.pendingInvitations = invitations.filter(inv => inv.status === 'pending');
          this.invitationsCount = this.pendingInvitations.length;
          this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
          console.log(`📧 ${this.invitationsCount} invitation(s) en attente`);
        },
        error: (error) => {
          console.error('❌ Erreur chargement invitations:', error);
          this.cdr.markForCheck(); // ✅ FORCER LA DÉTECTION
        }
      });
  }

  filterParticipants(event: any) {
    const term = event?.target?.value?.toLowerCase() || '';
    this.searchTerm = term;

    if (!term.trim()) {
      this.filteredParticipants = [...this.participants];
      return;
    }

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
      this.loadPendingInvitations();
    }
  }

  // ✅ CORRIGER : Utiliser AlertController au lieu de confirmAction custom
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

  // ✅ NOUVELLE MÉTHODE : Confirmer l'annulation
  private confirmCancelInvitation(invitationId: string) {
    this.invitationsService.deleteInvitation(invitationId).subscribe({
      next: () => {
        this.showToast('Invitation annulée', 'success');
        this.loadPendingInvitations();
      },
      error: (error) => {
        console.error('❌ Erreur annulation invitation:', error);
        this.showToast('Erreur lors de l\'annulation', 'danger');
      }
    });
  }

  trackById(index: number, participant: Participant): string {
    return participant.id || participant.userId;
  }

  trackByInvitationId(index: number, invitation: EventInvitation): string {
    return invitation.id || invitation.invitedUserId;
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  get canInviteFriends(): boolean {
    return this.permissions?.canInviteFriends && !this.isReadOnly;
  }

  get canManageRequests(): boolean {
    return this.permissions?.canManageRequests && !this.isReadOnly;
  }
}