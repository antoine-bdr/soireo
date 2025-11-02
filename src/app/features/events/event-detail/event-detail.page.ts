// src/app/features/events/event-detail/event-detail.page.ts
// ✅ VERSION AVEC GESTION DE LA CONFIDENTIALITÉ DES ADRESSES

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
  LoadingController,
  ModalController  // ✅ AJOUTÉ pour le modal
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
  eyeOffOutline,  // ✅ pour l'icône adresse masquée
  notificationsOutline,
  globeOutline,
  mailOutline  // ✅ AJOUTÉ pour l'icône demandes
} from 'ionicons/icons';

import { getEventAccessType, EventAccessType } from '../../../core/helpers/event-type.helper';

// ✅ AJOUT : Import du modal
import { PendingRequestsModalComponent } from '../../../shared/components/pending-requests-modal/pending-requests-modal.component';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { ParticipantsService } from '../../../core/services/participants.service';
// ✅ AJOUT : Service de visibilité des adresses
import { EventLocationVisibilityService } from '../../../core/services/event-location-visibility.service';

// ✅ MODIFICATION : Import des interfaces avec gestion de masquage
import { 
  Event, 
  EventWithConditionalLocation,
  EventLocation,
  MaskedEventLocation 
} from '../../../core/models/event.model';
import { Participant, ParticipantStatus } from '../../../core/models/participant.model';
import { take, switchMap } from 'rxjs/operators';
import { Subscription, of } from 'rxjs';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonChip,
    IonAvatar,
    IonSpinner,
    IonBadge,
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
  // ✅ AJOUT : Service de visibilité
  private readonly locationVisibilityService = inject(EventLocationVisibilityService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);
  // ✅ AJOUT : Modal controller
  private readonly modalCtrl = inject(ModalController);

  // État de la page
  eventId: string = '';
  // ✅ MODIFICATION : Type avec gestion de masquage
  event: EventWithConditionalLocation | null = null;
  isLoading = true;
  isOrganizer = false;

  // Sprint 3 : Participation
  isParticipating = false;
  participantCount = 0;
  participants: Participant[] = [];
  canJoin = true;
  canJoinReason = '';
  
  // ✅ AJOUT : Statut du participant pour la visibilité
  participantStatus?: ParticipantStatus;
  
  // ✅ AJOUT : Compteur demandes en attente
  pendingCount = 0;
  
  // Protection contre les clics multiples
  isJoining = false;
  isLeaving = false;

  // Gestion des subscriptions pour cleanup
  private subscriptions: Subscription[] = [];

  eventTypeInfo: EventAccessType | null = null;

  constructor() {
    addIcons({
      arrowBack,
      peopleOutline,
      calendarOutline,
      locationOutline,
      personAddOutline,
      exitOutline,
      warningOutline,
      personOutline,
      documentTextOutline,
      createOutline,
      trashOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      ellipsisVertical,
      shareOutline,
      lockClosedOutline,
      timeOutline,
      eyeOffOutline,
      notificationsOutline,
      globeOutline,
      mailOutline  // ✅ AJOUTÉ
    });
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
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    console.log('🧹 EventDetailPage destroyed - subscriptions cleaned');
  }

  /**
   * ✅ VERSION AVEC MASQUAGE CONDITIONNEL
   * Charge l'événement et applique le masquage selon les permissions
   */
  loadEvent() {
    this.isLoading = true;
    const currentUserId = this.authService.getCurrentUserId();

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

        // 2️⃣ Récupérer le statut du participant
        return this.participantsService.getUserParticipationStatus(this.eventId).pipe(
          take(1),
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
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur chargement événement:', error);
        this.showToast('Erreur lors du chargement', 'danger');
        this.isLoading = false;
        this.router.navigate(['/events']);
      }
    });

    this.subscriptions.push(eventSub);
  }

  /**
   * Charge les informations de participation (compteur, statut utilisateur)
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
    // ⚠️ On passe l'événement sans le masquage pour la vérification
    const eventForCheck = { 
      ...this.event, 
      location: this.getOriginalLocation() 
    } as Event;
    
    const canJoinSub = this.participantsService.canJoinEventReactive(eventForCheck).subscribe({
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
      // ✅ AJOUT : Charger le compteur de demandes en attente
      this.loadPendingCount();
    }
  }

  /**
   * Charge la liste complète des participants (organisateur uniquement)
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
    if (this.isJoining) {
      console.log('⚠️ Inscription déjà en cours, ignoré');
      return;
    }

    if (!this.event || this.isOrganizer || this.isParticipating) {
      return;
    }

    if (!this.canJoin) {
      this.showToast(this.canJoinReason || 'Impossible de rejoindre cet événement', 'warning');
      return;
    }

    this.isJoining = true;
    console.log('🔵 Début inscription...');

    const loading = await this.loadingCtrl.create({
      message: 'Inscription en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    // Utiliser l'événement original sans masquage
    const eventForJoin = { 
      ...this.event, 
      location: this.getOriginalLocation() 
    } as Event;

    this.participantsService.joinEvent(this.eventId, eventForJoin).subscribe({
      next: async () => {
        await loading.dismiss();
        this.isParticipating = true;
        this.isJoining = false;
        
        const message = this.event!.requiresApproval 
          ? '📨 Demande envoyée ! En attente d\'approbation.\n🔓 L\'adresse sera dévoilée après acceptation.'
          : '🎉 Vous participez maintenant à cet événement !';
        
        await this.showToast(message, 'success');
        console.log('✅ Inscription réussie');
        
        // ⚠️ IMPORTANT : Recharger l'événement pour mettre à jour la visibilité de l'adresse
        // Car le statut du participant vient de changer
        this.loadEvent();
      },
      error: async (error) => {
        await loading.dismiss();
        this.isJoining = false;
        console.error('❌ Erreur lors de l\'inscription:', error);
        
        let errorMessage = 'Erreur lors de l\'inscription';
        if (error.code === 'permission-denied') {
          errorMessage = 'Vous n\'avez pas la permission de rejoindre cet événement';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.showToast(errorMessage, 'danger');
      }
    });
  }

  /**
   * Permet à l'utilisateur de quitter l'événement
   */
  async leaveEvent() {
    if (this.isLeaving) {
      console.log('⚠️ Annulation déjà en cours, ignoré');
      return;
    }

    if (!this.event || !this.isParticipating) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Annuler la participation',
      message: 'Êtes-vous sûr de vouloir annuler votre participation ?',
      buttons: [
        {
          text: 'Non',
          role: 'cancel'
        },
        {
          text: 'Oui, annuler',
          role: 'destructive',
          handler: async () => {
            this.isLeaving = true;

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
                
                // ⚠️ IMPORTANT : Recharger l'événement pour masquer l'adresse
                this.loadEvent();
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
   * ✅ NOUVEAU : Vérifie si l'utilisateur a une demande en attente (PENDING)
   */
  isPending(): boolean {
    return this.participantStatus === ParticipantStatus.PENDING;
  }

  /**
   * ✅ NOUVEAU : Annuler une demande de participation en attente
   */
  async cancelRequest() {
    const alert = await this.alertCtrl.create({
      header: 'Annuler la demande',
      message: 'Êtes-vous sûr de vouloir annuler votre demande de participation ?',
      buttons: [
        {
          text: 'Non',
          role: 'cancel'
        },
        {
          text: 'Oui, annuler',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Annulation en cours...',
              spinner: 'crescent'
            });
            await loading.present();

            this.participantsService.leaveEvent(this.eventId).subscribe({
              next: async () => {
                await loading.dismiss();
                this.showToast('Demande annulée', 'success');
                console.log('✅ Demande annulée');
              },
              error: async (error) => {
                await loading.dismiss();
                console.error('❌ Erreur annulation demande:', error);
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
                this.router.navigate(['/tabs/events']);
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
    }
  }

  // ========================================
  // ✅ MÉTHODES POUR GESTION DE L'ADRESSE
  // ========================================

  /**
   * Vérifie si l'adresse est masquée
   */
  isAddressMasked(): boolean {
    if (!this.event) return false;
    return !this.event.canSeeFullAddress;
  }

  /**
   * Retourne l'adresse formatée pour l'affichage
   */
  getAddressDisplay(): string {
    if (!this.event) return '';
    
    return this.locationVisibilityService.formatAddressForDisplay(
      this.event.location
    );
  }

  /**
   * Retourne le message explicatif si l'adresse est masquée
   */
  getLocationMessage(): string {
    if (!this.event || this.event.canSeeFullAddress) return '';
    
    const location = this.event.location as MaskedEventLocation;
    return location.message || '';
  }

  /**
   * Récupère la localisation originale (utilisé pour les opérations internes)
   */
  private getOriginalLocation(): EventLocation {
    if (!this.event) {
      throw new Error('Event not loaded');
    }

    // Si l'adresse est visible, on retourne la location telle quelle
    if (this.event.canSeeFullAddress) {
      return this.event.location as EventLocation;
    }

    // Si masquée, on reconstruit une EventLocation partielle
    // (Normalement, on ne devrait jamais avoir besoin de ça dans un flow correct)
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

  /**
   * Retourne le label de la catégorie avec emoji
   */
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

  /**
   * Formate la date pour l'affichage
   */
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
   * Retourne le status du badge participants
   */
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
    
    // Récupérer le type réel depuis l'événement original
    const originalEvent = this.event as any; // Cast pour accéder aux props originales
    
    if (originalEvent.isPrivate) {
      return 'private';
    }
    
    if (originalEvent.requiresApproval) {
      return 'invitation';
    }
    
    return 'public';
  }
  
  /**
   * Retourne le label du type d'accès
   */
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
  
  /**
   * Retourne l'icône correspondant au type d'accès
   */
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
   * Retour à la page précédente
   */
  goBack() {
    this.router.navigate(['/tabs/events']);
  }

  // ========================================
  // ✅ NOUVELLES MÉTHODES : GESTION DES DEMANDES
  // ========================================

  /**
   * Charge le compteur de demandes en attente (temps réel)
   */
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

  /**
   * Ouvre le modal de gestion des demandes en attente
   */
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

}