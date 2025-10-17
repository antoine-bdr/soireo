import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonLabel,
  IonAvatar,
  IonList,
  IonItem,
  IonBadge,
  IonSpinner,
  AlertController,
  ToastController,
  LoadingController,
  ActionSheetController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  locationOutline,
  peopleOutline,
  personOutline,
  exitOutline,
  enterOutline,
  createOutline,
  trashOutline,
  shareOutline,
  heartOutline,
  heart,
  timeOutline, ellipsisVertical, checkmarkCircleOutline } from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { Event, EventCategory } from '../../../core/models/event.model';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
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
    IonLabel,
    IonAvatar,
    IonList,
    IonItem,
    IonBadge,
    IonSpinner
  ]
})
export class EventDetailPage implements OnInit {
  // Injection des services
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthenticationService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly actionSheetCtrl = inject(ActionSheetController);

  // État de la page
  event = signal<Event | null>(null);
  isLoading = signal(true);
  currentUserId = signal<string>('');

  constructor() {
    addIcons({shareOutline,ellipsisVertical,calendarOutline,locationOutline,peopleOutline,checkmarkCircleOutline,enterOutline,exitOutline,createOutline,trashOutline,personOutline,heartOutline,heart,timeOutline});
  }

  ngOnInit() {
    // Récupère l'ID de l'événement depuis l'URL
    const eventId = this.route.snapshot.paramMap.get('id');
    
    if (!eventId) {
      this.showToast('Événement introuvable', 'danger');
      this.router.navigate(['/events']);
      return;
    }

    // Récupère l'ID de l'utilisateur connecté
    const userId = this.authService.getCurrentUserId();
    if (userId) {
      this.currentUserId.set(userId);
    }

    // Charge l'événement depuis Firestore
    this.loadEvent(eventId);
  }

  /**
   * Charge les détails de l'événement
   */
  loadEvent(eventId: string) {
    this.isLoading.set(true);
    
    this.eventsService.getEventById(eventId).subscribe({
      next: (event) => {
        this.event.set(event);
        this.isLoading.set(false);
        
        if (!event) {
          this.showToast('Événement introuvable', 'danger');
          this.router.navigate(['/events']);
        }
      },
      error: (error) => {
        console.error('❌ Erreur chargement événement:', error);
        this.isLoading.set(false);
        this.showToast('Erreur de chargement', 'danger');
        this.router.navigate(['/events']);
      }
    });
  }

  /**
   * Rejoindre l'événement
   */
  async joinEvent() {
    const event = this.event();
    if (!event || !event.id) return;

    const loading = await this.loadingCtrl.create({
      message: 'Inscription en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    this.eventsService.joinEvent(event.id, this.currentUserId()).subscribe({
      next: async () => {
        await loading.dismiss();
        await this.showToast('🎉 Tu as rejoint l\'événement !', 'success');
      },
      error: async (error) => {
        await loading.dismiss();
        await this.showToast(error.message || 'Erreur lors de l\'inscription', 'danger');
      }
    });
  }

  /**
   * Quitter l'événement
   */
  async leaveEvent() {
    const event = this.event();
    if (!event || !event.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Quitter l\'événement',
      message: 'Es-tu sûr de vouloir quitter cet événement ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Quitter',
          role: 'destructive',
          handler: () => {
            this.confirmLeaveEvent(event.id!);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Confirmation de quitter l'événement
   */
  async confirmLeaveEvent(eventId: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Départ en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    this.eventsService.leaveEvent(eventId, this.currentUserId()).subscribe({
      next: async () => {
        await loading.dismiss();
        await this.showToast('Tu as quitté l\'événement', 'success');
      },
      error: async (error) => {
        await loading.dismiss();
        await this.showToast(error.message || 'Erreur', 'danger');
      }
    });
  }

  /**
   * Modifier l'événement
   */
  editEvent() {
    const event = this.event();
    if (!event || !event.id) return;
    
    // TODO: Créer la page d'édition
    this.showToast('Fonctionnalité à venir', 'warning');
  }

  /**
   * Supprimer l'événement
   */
  async deleteEvent() {
    const event = this.event();
    if (!event || !event.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Supprimer l\'événement',
      message: 'Es-tu sûr de vouloir supprimer cet événement ? Cette action est irréversible.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.confirmDeleteEvent(event.id!);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Confirmation de suppression
   */
  async confirmDeleteEvent(eventId: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Suppression...',
      spinner: 'crescent'
    });
    await loading.present();

    this.eventsService.deleteEvent(eventId).subscribe({
      next: async () => {
        await loading.dismiss();
        await this.showToast('Événement supprimé', 'success');
        this.router.navigate(['/events']);
      },
      error: async (error) => {
        await loading.dismiss();
        await this.showToast('Erreur de suppression', 'danger');
        console.error('Erreur:', error);
      }
    });
  }

  /**
   * Partager l'événement
   */
  async shareEvent() {
    const event = this.event();
    if (!event) return;

    // Utilise l'API Web Share si disponible
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: event.description,
          url: window.location.href
        });
      } catch (error) {
        console.log('Partage annulé');
      }
    } else {
      // Fallback : copie le lien
      navigator.clipboard.writeText(window.location.href);
      await this.showToast('Lien copié !', 'success');
    }
  }

  /**
   * Affiche les actions de l'organisateur
   */
  async showOrganizerActions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Actions',
      buttons: [
        {
          text: 'Modifier',
          icon: 'create-outline',
          handler: () => this.editEvent()
        },
        {
          text: 'Supprimer',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => this.deleteEvent()
        },
        {
          text: 'Annuler',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  /**
   * Vérifie si l'utilisateur est l'organisateur
   */
  isOrganizer(): boolean {
    const event = this.event();
    return event ? event.organizerId === this.currentUserId() : false;
  }

  /**
   * Vérifie si l'utilisateur participe déjà
   */
  isParticipant(): boolean {
    const event = this.event();
    return event ? event.participants.includes(this.currentUserId()) : false;
  }

  /**
   * Vérifie si l'événement est complet
   */
  isEventFull(): boolean {
    const event = this.event();
    return event ? event.currentParticipants >= event.maxParticipants : false;
  }

  /**
   * Formate la date pour l'affichage
   */
  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Retourne le libellé de la catégorie
   */
  getCategoryLabel(category: EventCategory): string {
    const labels: Record<EventCategory, string> = {
      [EventCategory.PARTY]: '🎉 Soirée',
      [EventCategory.CONCERT]: '🎵 Concert',
      [EventCategory.FESTIVAL]: '🎪 Festival',
      [EventCategory.BAR]: '🍺 Bar',
      [EventCategory.CLUB]: '💃 Club',
      [EventCategory.OUTDOOR]: '🌳 Extérieur',
      [EventCategory.PRIVATE]: '🔒 Privé',
      [EventCategory.OTHER]: '📌 Autre'
    };
    return labels[category] || category;
  }

  /**
   * Retourne la couleur de la catégorie
   */
  getCategoryColor(category: EventCategory): string {
    const colors: Record<EventCategory, string> = {
      [EventCategory.PARTY]: 'primary',
      [EventCategory.CONCERT]: 'secondary',
      [EventCategory.FESTIVAL]: 'tertiary',
      [EventCategory.BAR]: 'warning',
      [EventCategory.CLUB]: 'danger',
      [EventCategory.OUTDOOR]: 'success',
      [EventCategory.PRIVATE]: 'medium',
      [EventCategory.OTHER]: 'dark'
    };
    return colors[category] || 'medium';
  }

  /**
   * Affiche un message toast
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
}