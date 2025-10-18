// src/app/features/events/event-detail/event-detail.page.ts
// Page de détail d'un événement avec système de participation (SPRINT 3)

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  AlertController,
  ToastController,
  LoadingController
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
  closeCircleOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { Event } from '../../../core/models/event.model';
import { Participant } from '../../../core/models/participant.model';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
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
    IonLabel
  ]
})
export class EventDetailPage implements OnInit {
  // Injection des services
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthenticationService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);

  // État de la page
  eventId: string = '';
  event: Event | null = null;
  isLoading = true;
  isOrganizer = false;

  // 🆕 Sprint 3 : Participation
  isParticipating = false;
  participantCount = 0;
  participants: Participant[] = [];
  canJoin = true;
  canJoinReason = '';
  
  // 🔧 FIX : Protection contre les clics multiples
  isJoining = false;
  isLeaving = false;

  constructor() {
    // Enregistrement des icônes
    addIcons({
      createOutline,
      trashOutline,
      personOutline,
      calendarOutline,
      locationOutline,
      peopleOutline,
      lockClosedOutline,
      checkmarkCircleOutline,
      personAddOutline,
      shareOutline,
      timeOutline,
      ellipsisVertical,
      exitOutline,
      closeCircleOutline
    });
  }

  ngOnInit() {
    // Récupère l'ID de l'événement depuis l'URL
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    
    if (!this.eventId) {
      this.showToast('Événement introuvable', 'danger');
      this.router.navigate(['/events']);
      return;
    }

    this.loadEvent();
  }

  /**
   * Charge l'événement depuis Firestore
   */
  loadEvent() {
    this.isLoading = true;

    this.eventsService.getEventById(this.eventId).subscribe({
      next: (event) => {
        if (!event) {
          this.showToast('Événement introuvable', 'danger');
          this.router.navigate(['/events']);
          return;
        }

        this.event = event;
        this.checkIfOrganizer();
        
        // 🆕 Charge les informations de participation
        this.loadParticipationInfo();
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement de l\'événement:', error);
        this.showToast('Erreur lors du chargement', 'danger');
        this.isLoading = false;
        this.router.navigate(['/events']);
      }
    });
  }

  /**
   * Vérifie si l'utilisateur connecté est l'organisateur
   */
  checkIfOrganizer() {
    const currentUserId = this.authService.getCurrentUserId();
    this.isOrganizer = this.event?.organizerId === currentUserId;
  }

  // ========================================
  // 🆕 SPRINT 3 : GESTION PARTICIPATION
  // ========================================

  /**
   * Charge les informations de participation (compteur, statut utilisateur)
   * 🔧 FIX : Utilise take(1) pour éviter les boucles infinies
   */
  loadParticipationInfo() {
    if (!this.event) return;

    console.log('🔍 Chargement des infos de participation...');

    // Charge le nombre de participants (temps réel pour le compteur)
    this.participantsService.getParticipantCount(this.eventId).subscribe({
      next: (count) => {
        this.participantCount = count;
        console.log(`👥 Compteur participants: ${count}`);
      }
    });

    // Vérifie si l'utilisateur participe déjà (one-time)
    this.participantsService.isUserParticipating(this.eventId).pipe(
      take(1) // ← CORRECTION : Une seule vérification
    ).subscribe({
      next: (isParticipating) => {
        this.isParticipating = isParticipating;
        console.log(`✅ isParticipating: ${isParticipating}`);
      }
    });

    // Vérifie si l'utilisateur peut rejoindre (one-time)
    this.participantsService.canJoinEventObservable(this.event).pipe(
      take(1) // ← CORRECTION : Une seule vérification
    ).subscribe({
      next: (result) => {
        this.canJoin = result.allowed;
        this.canJoinReason = result.reason || '';
        console.log(`✅ canJoin: ${result.allowed}, reason: ${result.reason || 'N/A'}`);
      }
    });

    // Charge la liste des participants (pour l'organisateur)
    if (this.isOrganizer) {
      this.loadParticipants();
    }
  }

  /**
   * Charge la liste complète des participants (organisateur uniquement)
   */
  loadParticipants() {
    this.participantsService.getParticipants(this.eventId).subscribe({
      next: (participants) => {
        this.participants = participants;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des participants:', error);
      }
    });
  }

  /**
   * Permet à l'utilisateur de rejoindre l'événement
   */
  async joinEvent() {
    // 🔧 FIX : Empêche les clics multiples
    if (this.isJoining) {
      console.log('⚠️ Inscription déjà en cours, ignoré');
      return;
    }

    if (!this.event || this.isOrganizer || this.isParticipating) {
      return;
    }

    // Vérifie une dernière fois avant de rejoindre
    if (!this.canJoin) {
      this.showToast(this.canJoinReason || 'Impossible de rejoindre cet événement', 'warning');
      return;
    }

    // 🔧 FIX : Active le flag de protection
    this.isJoining = true;
    console.log('🔵 Début inscription...');

    const loading = await this.loadingCtrl.create({
      message: 'Inscription en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    this.participantsService.joinEvent(this.eventId, this.event).subscribe({
      next: async () => {
        await loading.dismiss();
        this.isParticipating = true;
        this.isJoining = false; // 🔧 FIX : Libère le flag
        
        const message = this.event!.requiresApproval 
          ? 'Demande envoyée ! En attente d\'approbation de l\'organisateur.'
          : 'Vous participez maintenant à cet événement ! 🎉';
        
        await this.showToast(message, 'success');
        console.log('✅ Inscription réussie');
        
        // Recharge les infos de participation
        this.loadParticipationInfo();
      },
      error: async (error) => {
        await loading.dismiss();
        this.isJoining = false; // 🔧 FIX : Libère le flag en cas d'erreur
        console.error('❌ Erreur lors de l\'inscription:', error);
        this.showToast(error.message || 'Erreur lors de l\'inscription', 'danger');
      }
    });
  }

  /**
   * Permet à l'utilisateur d'annuler sa participation
   */
  async leaveEvent() {
    // 🔧 FIX : Empêche les clics multiples
    if (this.isLeaving) {
      console.log('⚠️ Annulation déjà en cours, ignoré');
      return;
    }

    if (!this.isParticipating) {
      return;
    }

    // Demande confirmation
    const alert = await this.alertCtrl.create({
      header: 'Annuler votre participation',
      message: 'Êtes-vous sûr de vouloir annuler votre participation à cet événement ?',
      buttons: [
        {
          text: 'Non',
          role: 'cancel'
        },
        {
          text: 'Oui, annuler',
          role: 'destructive',
          handler: () => {
            this.confirmLeaveEvent();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Confirme l'annulation de participation
   */
  async confirmLeaveEvent() {
    // 🔧 FIX : Active le flag de protection
    this.isLeaving = true;
    console.log('🔵 Début annulation...');

    const loading = await this.loadingCtrl.create({
      message: 'Annulation en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    this.participantsService.leaveEvent(this.eventId).subscribe({
      next: async () => {
        await loading.dismiss();
        this.isParticipating = false;
        this.isLeaving = false; // 🔧 FIX : Libère le flag
        await this.showToast('Participation annulée', 'success');
        console.log('✅ Annulation réussie');
        
        // Recharge les infos
        this.loadParticipationInfo();
      },
      error: async (error) => {
        await loading.dismiss();
        this.isLeaving = false; // 🔧 FIX : Libère le flag en cas d'erreur
        console.error('❌ Erreur lors de l\'annulation:', error);
        this.showToast('Erreur lors de l\'annulation', 'danger');
      }
    });
  }

  /**
   * Retire un participant (organisateur uniquement)
   */
  async removeParticipant(participant: Participant) {
    if (!this.isOrganizer) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Retirer ce participant',
      message: `Voulez-vous retirer ${participant.userName} de cet événement ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Retirer',
          role: 'destructive',
          handler: () => {
            this.confirmRemoveParticipant(participant.id!);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Confirme le retrait d'un participant
   */
  async confirmRemoveParticipant(participantId: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Retrait en cours...'
    });
    await loading.present();

    this.participantsService.removeParticipant(participantId).subscribe({
      next: async () => {
        await loading.dismiss();
        await this.showToast('Participant retiré', 'success');
        // La liste se met à jour automatiquement via onSnapshot
      },
      error: async (error) => {
        await loading.dismiss();
        console.error('Erreur lors du retrait:', error);
        this.showToast('Erreur lors du retrait', 'danger');
      }
    });
  }

  // ========================================
  // ACTIONS ORGANISATEUR
  // ========================================

  /**
   * Navigue vers la page d'édition
   */
  editEvent() {
    if (!this.isOrganizer) {
      this.showToast('Vous n\'êtes pas autorisé à modifier cet événement', 'danger');
      return;
    }
    this.router.navigate(['/events/edit', this.eventId]);
  }

  /**
   * Supprime l'événement après confirmation
   */
  async deleteEvent() {
    if (!this.isOrganizer) {
      this.showToast('Vous n\'êtes pas autorisé à supprimer cet événement', 'danger');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer l'événement "${this.event?.title}" ? Cette action est irréversible.`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          cssClass: 'danger',
          handler: () => {
            this.confirmDelete();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Exécute la suppression après confirmation
   */
  async confirmDelete() {
    const loading = await this.loadingCtrl.create({
      message: 'Suppression en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.eventsService.deleteEvent(this.eventId).toPromise();
      await loading.dismiss();
      await this.showToast('Événement supprimé avec succès', 'success');
      this.router.navigate(['/events'], { replaceUrl: true });
    } catch (error) {
      await loading.dismiss();
      console.error('Erreur lors de la suppression:', error);
      this.showToast('Erreur lors de la suppression de l\'événement', 'danger');
    }
  }

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Formate la date de l'événement
   */
  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /**
   * Retourne le label de la catégorie avec emoji
   */
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      'party': '🎉 Soirée',
      'concert': '🎵 Concert',
      'festival': '🎪 Festival',
      'bar': '🍺 Bar',
      'club': '💃 Club',
      'outdoor': '🌳 Extérieur',
      'private': '🔒 Privé',
      'other': '📌 Autre'
    };
    return labels[category] || category;
  }

  /**
   * Retourne la couleur de la catégorie
   */
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

  /**
   * Vérifie si l'événement est complet
   */
  isEventFull(): boolean {
    if (!this.event) return false;
    return this.participantCount >= this.event.maxParticipants;
  }

  /**
   * Affiche un toast message
   */
  async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  /**
   * Partage l'événement (placeholder pour future implémentation)
   */
  shareEvent() {
    this.showToast('Fonctionnalité de partage à venir', 'warning');
  }
}