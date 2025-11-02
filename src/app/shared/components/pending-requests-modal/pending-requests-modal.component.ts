// src/app/features/events/components/pending-requests-modal/pending-requests-modal.component.ts
// 🔔 Modal de gestion des demandes de participation en attente

import { Component, OnInit, OnDestroy, Input, inject } from '@angular/core';
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
  IonLabel,
  IonAvatar,
  IonBadge,
  IonSpinner,
  ModalController,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  personOutline
} from 'ionicons/icons';

import { ParticipantsService } from './../../../core/services/participants.service';
import { Participant, ParticipantStatus } from './../../../core/models/participant.model';
import { Subscription } from 'rxjs';

/**
 * ========================================
 * 🔔 MODAL : GESTION DES DEMANDES EN ATTENTE
 * ========================================
 * 
 * Responsabilités :
 * - Afficher la liste des participants en attente
 * - Permettre d'approuver ou rejeter une demande
 * - Mise à jour en temps réel
 * - Feedback utilisateur (toasts, confirmations)
 */
@Component({
  selector: 'app-pending-requests-modal',
  templateUrl: './pending-requests-modal.component.html',
  styleUrls: ['./pending-requests-modal.component.scss'],
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
    IonLabel,
    IonAvatar,
    IonBadge,
    IonSpinner
  ]
})
export class PendingRequestsModalComponent implements OnInit, OnDestroy {
  // ========================================
  // INPUTS & SERVICES
  // ========================================
  
  @Input() eventId: string = '';
  @Input() eventTitle: string = '';
  
  private readonly modalCtrl = inject(ModalController);
  private readonly participantsService = inject(ParticipantsService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  // ========================================
  // STATE
  // ========================================
  
  pendingParticipants: Participant[] = [];
  isLoading = true;
  
  // Protection contre les clics multiples
  processingIds = new Set<string>();
  
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({
      closeOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      timeOutline,
      personOutline
    });
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  ngOnInit() {
    console.log('🔔 PendingRequestsModal init - eventId:', this.eventId);
    
    if (!this.eventId) {
      this.showToast('Erreur : ID événement manquant', 'danger');
      this.close();
      return;
    }

    this.loadPendingRequests();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub?.unsubscribe());
    console.log('🧹 PendingRequestsModal destroyed');
  }

  // ========================================
  // DATA LOADING
  // ========================================

  /**
   * Charge les participants en attente (temps réel)
   */
  loadPendingRequests() {
    this.isLoading = true;

    const sub = this.participantsService.getPendingParticipants(this.eventId).subscribe({
      next: (participants) => {
        this.pendingParticipants = participants;
        this.isLoading = false;
        console.log(`🔔 ${participants.length} demandes en attente`);
      },
      error: (error) => {
        console.error('❌ Erreur chargement demandes:', error);
        this.isLoading = false;
        this.showToast('Erreur lors du chargement', 'danger');
      }
    });

    this.subscriptions.push(sub);
  }

  // ========================================
  // ACTIONS
  // ========================================

  /**
   * Approuve une demande de participation
   */
  async approveRequest(participant: Participant) {
    if (!participant.id) return;
    
    // Protection contre les clics multiples
    if (this.processingIds.has(participant.id)) {
      console.log('⚠️ Déjà en cours de traitement');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Approuver la demande',
      message: `Accepter la participation de ${participant.userName} ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Approuver',
          handler: () => this.confirmApprove(participant)
        }
      ]
    });

    await alert.present();
  }

  /**
   * Confirme l'approbation
   */
  private confirmApprove(participant: Participant) {
    if (!participant.id) return;

    this.processingIds.add(participant.id);
    console.log('✅ Approbation en cours:', participant.userName);

    this.participantsService.approveParticipant(participant.id).subscribe({
      next: async () => {
        this.processingIds.delete(participant.id!);
        await this.showToast(`✅ ${participant.userName} a été accepté !`, 'success');
        console.log('✅ Participant approuvé');
      },
      error: async (error) => {
        this.processingIds.delete(participant.id!);
        console.error('❌ Erreur approbation:', error);
        await this.showToast('Erreur lors de l\'approbation', 'danger');
      }
    });
  }

  /**
   * Rejette une demande de participation
   */
  async rejectRequest(participant: Participant) {
    if (!participant.id) return;
    
    // Protection contre les clics multiples
    if (this.processingIds.has(participant.id)) {
      console.log('⚠️ Déjà en cours de traitement');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Refuser la demande',
      message: `Êtes-vous sûr de vouloir refuser la participation de ${participant.userName} ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Refuser',
          role: 'destructive',
          handler: () => this.confirmReject(participant)
        }
      ]
    });

    await alert.present();
  }

  /**
   * Confirme le rejet
   */
  private confirmReject(participant: Participant) {
    if (!participant.id) return;

    this.processingIds.add(participant.id);
    console.log('❌ Rejet en cours:', participant.userName);

    this.participantsService.rejectParticipant(participant.id).subscribe({
      next: async () => {
        this.processingIds.delete(participant.id!);
        await this.showToast(`${participant.userName} a été refusé`, 'warning');
        console.log('❌ Participant rejeté');
      },
      error: async (error) => {
        this.processingIds.delete(participant.id!);
        console.error('❌ Erreur rejet:', error);
        await this.showToast('Erreur lors du rejet', 'danger');
      }
    });
  }

  // ========================================
  // HELPERS
  // ========================================

  /**
   * Vérifie si un participant est en cours de traitement
   */
  isProcessing(participantId?: string): boolean {
    return participantId ? this.processingIds.has(participantId) : false;
  }

  /**
   * Formate la date d'inscription
   */
  formatJoinedDate(timestamp: any): string {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      if (diffDays === 1) return 'Hier';
      if (diffDays < 7) return `Il y a ${diffDays} jours`;
      
      return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short' 
      });
    } catch (error) {
      console.error('Erreur formatage date:', error);
      return '';
    }
  }

  /**
   * Affiche un toast
   */
  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  /**
   * Ferme le modal
   */
  close() {
    this.modalCtrl.dismiss();
  }
}