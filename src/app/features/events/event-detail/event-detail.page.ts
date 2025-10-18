import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
  closeCircleOutline, warningOutline } from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { Event } from '../../../core/models/event.model';
import { Participant } from '../../../core/models/participant.model';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

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
export class EventDetailPage implements OnInit, OnDestroy {
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

  // Sprint 3 : Participation
  isParticipating = false;
  participantCount = 0;
  participants: Participant[] = [];
  canJoin = true;
  canJoinReason = '';
  
  // Protection contre les clics multiples
  isJoining = false;
  isLeaving = false;

  // 🆕 GESTION DES SUBSCRIPTIONS POUR CLEANUP
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({createOutline,trashOutline,checkmarkCircleOutline,closeCircleOutline,peopleOutline,exitOutline,personAddOutline,warningOutline,calendarOutline,locationOutline,personOutline,ellipsisVertical,shareOutline,lockClosedOutline,timeOutline});
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

  // 🆕 CLEANUP DES SUBSCRIPTIONS
  ngOnDestroy() {
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    console.log('🧹 EventDetailPage destroyed - subscriptions cleaned');
  }

  /**
   * Charge l'événement depuis Firestore
   * 🆕 VERSION avec stockage de la subscription
   */
  loadEvent() {
    this.isLoading = true;

    const eventSub = this.eventsService.getEventById(this.eventId).subscribe({
      next: (event) => {
        if (!event) {
          this.showToast('Événement introuvable', 'danger');
          this.router.navigate(['/events']);
          return;
        }

        this.event = event;
        this.checkIfOrganizer();
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
    this.subscriptions.push(eventSub);
  }

  /**
   * Vérifie si l'utilisateur connecté est l'organisateur
   */
  checkIfOrganizer() {
    const currentUserId = this.authService.getCurrentUserId();
    this.isOrganizer = this.event?.organizerId === currentUserId;
  }

  /**
   * Charge les informations de participation (compteur, statut utilisateur)
   * 🆕 VERSION avec stockage des subscriptions pour réactivité temps réel
   */
  loadParticipationInfo() {
    if (!this.event) return;

    console.log('🔍 Chargement des infos de participation...');

    // Compteur de participants (temps réel)
    const countSub = this.participantsService.getParticipantCount(this.eventId).subscribe({
      next: (count) => {
        this.participantCount = count;
        console.log(`👥 Compteur participants: ${count}`);
      }
    });
    this.subscriptions.push(countSub);

    // Statut participation utilisateur (temps réel)
    const participatingSub = this.participantsService.isUserParticipating(this.eventId).subscribe({
      next: (isParticipating) => {
        this.isParticipating = isParticipating;
        console.log(`✅ isParticipating: ${isParticipating}`);
      }
    });
    this.subscriptions.push(participatingSub);

    // Vérification possibilité de rejoindre (temps réel)
    const canJoinSub = this.participantsService.canJoinEventReactive(this.event).subscribe({
      next: (result) => {
        this.canJoin = result.allowed;
        this.canJoinReason = result.reason || '';
        console.log(`✅ canJoin: ${result.allowed}, reason: ${result.reason || 'N/A'}`);
      }
    });
    this.subscriptions.push(canJoinSub);

    // Liste participants (organisateur uniquement, temps réel)
    if (this.isOrganizer) {
      this.loadParticipants();
    }
  }

  /**
   * Charge la liste complète des participants (organisateur uniquement)
   * 🆕 VERSION avec stockage de la subscription
   */
  loadParticipants() {
    const participantsSub = this.participantsService.getParticipants(this.eventId).subscribe({
      next: (participants) => {
        this.participants = participants;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des participants:', error);
      }
    });
    this.subscriptions.push(participantsSub);
  }

  /**
   * Permet à l'utilisateur de rejoindre l'événement
   */
  async joinEvent() {
    // Protection contre les clics multiples
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

    // Active le flag de protection
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
        this.isJoining = false;
        
        const message = this.event!.requiresApproval 
          ? 'Demande envoyée ! En attente d\'approbation de l\'organisateur.'
          : 'Vous participez maintenant à cet événement ! 🎉';
        
        await this.showToast(message, 'success');
        console.log('✅ Inscription réussie');
        
        // 🆕 Plus besoin de recharger - les observables temps réel mettent à jour automatiquement !
      },
      error: async (error) => {
        await loading.dismiss();
        this.isJoining = false;
        console.error('❌ Erreur lors de l\'inscription:', error);
        this.showToast(error.message || 'Erreur lors de l\'inscription', 'danger');
      }
    });
  }

  /**
   * Permet à l'utilisateur d'annuler sa participation
   */
  async leaveEvent() {
    // Protection contre les clics multiples
    if (this.isLeaving) {
      console.log('⚠️ Annulation déjà en cours, ignoré');
      return;
    }

    if (!this.isParticipating) {
      return;
    }

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
          role: 'confirm',
          handler: async () => {
            this.isLeaving = true;
            console.log('🔴 Début annulation...');

            const loading = await this.loadingCtrl.create({
              message: 'Annulation en cours...',
              spinner: 'crescent'
            });
            await loading.present();

            this.participantsService.leaveEvent(this.eventId).subscribe({
              next: async () => {
                await loading.dismiss();
                this.isParticipating = false;
                this.isLeaving = false;
                await this.showToast('Participation annulée', 'success');
                console.log('✅ Annulation réussie');
                
                // 🆕 Plus besoin de recharger - les observables temps réel mettent à jour automatiquement !
              },
              error: async (error) => {
                await loading.dismiss();
                this.isLeaving = false;
                console.error('❌ Erreur lors de l\'annulation:', error);
                this.showToast('Erreur lors de l\'annulation', 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Retirer un participant (organisateur uniquement)
   */
  async removeParticipant(participant: Participant) {
    const alert = await this.alertCtrl.create({
      header: 'Retirer ce participant',
      message: `Êtes-vous sûr de vouloir retirer ${participant.userName} ?`,
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
              message: 'Suppression en cours...',
              spinner: 'crescent'
            });
            await loading.present();

            this.participantsService.removeParticipant(participant.id!).subscribe({
              next: async () => {
                await loading.dismiss();
                await this.showToast('Participant retiré', 'success');
                
                // 🆕 Plus besoin de recharger - l'observable temps réel met à jour la liste automatiquement !
              },
              error: async (error) => {
                await loading.dismiss();
                console.error('Erreur suppression participant:', error);
                this.showToast('Erreur lors de la suppression', 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Éditer l'événement (organisateur uniquement)
   */
  editEvent() {
    this.router.navigate(['/events', this.eventId, 'edit']);
  }

  /**
   * Supprimer l'événement (organisateur uniquement)
   */
  async deleteEvent() {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer l\'événement',
      message: 'Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.',
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
              message: 'Suppression en cours...',
              spinner: 'crescent'
            });
            await loading.present();

            this.eventsService.deleteEvent(this.eventId).subscribe({
              next: async () => {
                await loading.dismiss();
                await this.showToast('Événement supprimé', 'success');
                this.router.navigate(['/events']);
              },
              error: async (error) => {
                await loading.dismiss();
                console.error('Erreur lors de la suppression:', error);
                this.showToast('Erreur lors de la suppression', 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  goToOrganizerProfile() {
    if (this.event && this.event.organizerId) {
      console.log('🔗 Navigation vers profil:', this.event.organizerId);
      
      this.showToast(
        `Fonctionnalité "Voir le profil" à venir prochainement !`, 
        'success'
      );
      
      // TODO : Créer page public-profile/:userId
      // this.router.navigate(['/public-profile', this.event.organizerId]);
    }
  }

  /**
   * Formate la date pour l'affichage
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