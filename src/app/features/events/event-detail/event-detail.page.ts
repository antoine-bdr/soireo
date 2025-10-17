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
  AlertController,
  ToastController
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
  trashOutline, lockClosedOutline, checkmarkCircleOutline, personAddOutline } from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { Event } from '../../../core/models/event.model';
import { user } from '@angular/fire/auth';

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
    IonSpinner,
    IonFab,
    IonFabButton
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

  // État de la page
  eventId: string = '';
  event: Event | null = null;
  isLoading = true;
  isOrganizer = false; // 👈 Nouvelle propriété pour vérifier si l'utilisateur est l'organisateur

  constructor() {
    addIcons({createOutline,trashOutline,personOutline,calendarOutline,locationOutline,peopleOutline,lockClosedOutline,checkmarkCircleOutline,personAddOutline,shareOutline,timeOutline});
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
// Dans loadEvent(), ajoute après la ligne 111
        console.log('🔍 currentUserId:', this.authService.currentUser()?.uid);
        console.log('🔍 organizerId:', event.organizerId);
        
        this.event = event;
        
        // 👇 Vérifie si l'utilisateur connecté est l'organisateur
        const currentUserId = this.authService.currentUser()?.uid;
        this.isOrganizer = event.organizerId === currentUserId;
        
        this.isLoading = false;
        console.log('✅ Événement chargé:', event);
        console.log('🔍 isOrganizer:', this.isOrganizer);
      },
      error: (error) => {
        console.error('❌ Erreur chargement événement:', error);
        this.showToast('Erreur de chargement', 'danger');
        this.router.navigate(['/events']);
      }
    });
  }

  /**
   * Formate la date pour l'affichage
   */
  formatDate(date: any): string {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Retourne l'emoji de la catégorie
   */
  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'PARTY': '🎉',
      'CONCERT': '🎵',
      'FESTIVAL': '🎪',
      'BAR': '🍺',
      'CLUB': '💃',
      'OUTDOOR': '🌳',
      'PRIVATE': '🔒',
      'OTHER': '📌'
    };
    return icons[category] || '📌';
  }

  /**
   * Navigation vers la page d'édition
   */
  goToEdit() {
    if (!this.isOrganizer) {
      this.showToast('Seul l\'organisateur peut modifier l\'événement', 'warning');
      return;
    }
    this.router.navigate(['/events', this.eventId, 'edit']);
  }

  /**
   * Supprime l'événement après confirmation
   */
  async deleteEvent() {
    if (!this.isOrganizer) {
      this.showToast('Seul l\'organisateur peut supprimer l\'événement', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Supprimer l\'événement',
      message: 'Cette action est irréversible. Êtes-vous sûr ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: async () => {
            try {
              await this.eventsService.deleteEvent(this.eventId).toPromise();
              await this.showToast('✅ Événement supprimé', 'success');
              this.router.navigate(['/events']);
            } catch (error: any) {
              console.error('❌ Erreur suppression:', error);
              await this.showToast('Erreur lors de la suppression', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Partage l'événement
   */
  async shareEvent() {
    if (!this.event) return;

    // Si l'API Web Share est disponible (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: this.event.title,
          text: this.event.description,
          url: window.location.href
        });
        console.log('✅ Événement partagé');
      } catch (error) {
        console.log('Partage annulé');
      }
    } else {
      // Fallback : copier le lien
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      await this.showToast('Lien copié dans le presse-papier', 'success');
    }
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