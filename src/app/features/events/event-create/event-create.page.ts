// src/app/features/events/event-create/event-create.page.ts
// Page de création d'un nouvel événement

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonToggle,
  IonText,
  IonDatetimeButton,
  IonModal,
  IonDatetime,
  LoadingController,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  closeOutline,
  saveOutline,
  calendarOutline,
  locationOutline,
  peopleOutline,
  lockClosedOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { StorageService } from '../../../core/services/storage.service';
import { CreateEventDto, EventCategory, EventLocation } from '../../../core/models/event.model';

@Component({
  selector: 'app-event-create',
  templateUrl: './event-create.page.html',
  styleUrls: ['./event-create.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonToggle,
    IonText,
    IonDatetimeButton,
    IonModal,
    IonDatetime
  ]
})
export class EventCreatePage implements OnInit {
  // Injection des services
  private readonly fb = inject(FormBuilder);
  private readonly eventsService = inject(EventsService);
  private readonly storageService = inject(StorageService);
  private readonly router = inject(Router);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  // Formulaire
  eventForm!: FormGroup;
  
  // Image
  selectedImage: File | null = null;
  imagePreview: string | null = null;

  // Date minimale (aujourd'hui)
  minDate: string = new Date().toISOString();

  // Catégories disponibles
  categories = [
    { value: EventCategory.PARTY, label: '🎉 Soirée' },
    { value: EventCategory.CONCERT, label: '🎵 Concert' },
    { value: EventCategory.FESTIVAL, label: '🎪 Festival' },
    { value: EventCategory.BAR, label: '🍺 Bar' },
    { value: EventCategory.CLUB, label: '💃 Club' },
    { value: EventCategory.OUTDOOR, label: '🌳 Extérieur' },
    { value: EventCategory.PRIVATE, label: '🔒 Privé' },
    { value: EventCategory.OTHER, label: '📌 Autre' }
  ];

  constructor() {
    addIcons({
      cameraOutline,
      closeOutline,
      saveOutline,
      calendarOutline,
      locationOutline,
      peopleOutline,
      lockClosedOutline,
      checkmarkCircleOutline
    });
  }

  ngOnInit() {
    this.initForm();
  }

  /**
   * Initialise le formulaire avec validation
   */
  initForm() {
    this.eventForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      date: ['', Validators.required],
      category: [EventCategory.PARTY, Validators.required],
      maxParticipants: [10, [Validators.required, Validators.min(2), Validators.max(1000)]],
      isPrivate: [false],
      requiresApproval: [false],
      // Location
      address: ['', Validators.required],
      city: ['', Validators.required],
      zipCode: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]]
    });
  }

  /**
   * Gestion de la sélection d'image
   */
  async onImageSelected(event: any) {
    const file = event.target.files[0];
    
    if (!file) return;

    // Validation du type
    if (!this.storageService.isValidImage(file)) {
      await this.showToast('Seules les images (JPG, PNG, GIF, WebP) sont acceptées', 'warning');
      return;
    }

    // Validation de la taille (5MB max)
    if (!this.storageService.isValidSize(file, 5)) {
      await this.showToast('L\'image ne doit pas dépasser 5MB', 'warning');
      return;
    }

    this.selectedImage = file;

    // Prévisualisation
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreview = e.target.result;
    };
    reader.readAsDataURL(file);

    console.log('✅ Image sélectionnée:', file.name);
  }

  /**
   * Supprime l'image sélectionnée
   */
  removeImage() {
    this.selectedImage = null;
    this.imagePreview = null;
  }

  /**
   * Gestion du changement de date
   */
  onDateChange(event: any) {
    const selectedDate = event.detail.value;
    this.eventForm.patchValue({ date: selectedDate });
  }

  /**
   * Formate la date sélectionnée pour l'affichage
   */
  formatSelectedDate(dateString: string): string {
    if (!dateString) return 'Sélectionner une date';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Crée l'événement
   */
  async createEvent() {
    if (this.eventForm.invalid) {
      await this.showToast('Veuillez remplir tous les champs correctement', 'warning');
      this.markFormGroupTouched(this.eventForm);
      return;
    }

    // Confirmation si pas d'image
    if (!this.selectedImage) {
      const alert = await this.alertCtrl.create({
        header: 'Aucune image',
        message: 'Voulez-vous créer l\'événement sans image ?',
        buttons: [
          { text: 'Annuler', role: 'cancel' },
          { text: 'Continuer', handler: () => this.submitEvent() }
        ]
      });
      await alert.present();
    } else {
      await this.submitEvent();
    }
  }

  /**
   * Soumet l'événement à Firestore
   */
  private async submitEvent() {
    const loading = await this.loadingCtrl.create({
      message: 'Création de l\'événement...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      let imageUrl = '';

      // Upload de l'image si présente
      if (this.selectedImage) {
        loading.message = 'Upload de l\'image...';
        imageUrl = await this.storageService
          .uploadImageWithAutoName(this.selectedImage, 'events')
          .toPromise() || '';
      }

      // Prépare les données
      const formValue = this.eventForm.value;
      
      const location: EventLocation = {
        address: formValue.address,
        city: formValue.city,
        zipCode: formValue.zipCode,
        latitude: 0, // TODO: Géolocalisation avec Google Maps API
        longitude: 0
      };

      const eventData: CreateEventDto = {
        title: formValue.title,
        description: formValue.description,
        date: new Date(formValue.date),
        location: location,
        maxParticipants: formValue.maxParticipants,
        category: formValue.category,
        imageUrl: imageUrl,
        isPrivate: formValue.isPrivate,
        requiresApproval: formValue.requiresApproval,
        tags: [] // TODO: Ajouter un champ tags plus tard
      };

      // Crée l'événement dans Firestore
      loading.message = 'Enregistrement...';
      const eventId = await this.eventsService.createEvent(eventData).toPromise();

      await loading.dismiss();
      await this.showToast('🎉 Événement créé avec succès !', 'success');

      // Redirige vers le détail de l'événement
      this.router.navigate(['/events', eventId]);

    } catch (error: any) {
      await loading.dismiss();
      console.error('❌ Erreur création événement:', error);
      await this.showToast(
        error.message || 'Erreur lors de la création de l\'événement',
        'danger'
      );
    }
  }

  /**
   * Marque tous les champs comme touchés (pour afficher les erreurs)
   */
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
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

  /**
   * Getters pour faciliter l'accès aux contrôles dans le template
   */
  get title() { return this.eventForm.get('title'); }
  get description() { return this.eventForm.get('description'); }
  get date() { return this.eventForm.get('date'); }
  get category() { return this.eventForm.get('category'); }
  get maxParticipants() { return this.eventForm.get('maxParticipants'); }
  get address() { return this.eventForm.get('address'); }
  get city() { return this.eventForm.get('city'); }
  get zipCode() { return this.eventForm.get('zipCode'); }
  get isPrivate() { return this.eventForm.get('isPrivate'); }
  get requiresApproval() { return this.eventForm.get('requiresApproval'); }
}