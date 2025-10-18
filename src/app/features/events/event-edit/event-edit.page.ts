import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonSpinner,
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
  checkmarkCircleOutline, warningOutline } from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { StorageService } from '../../../core/services/storage.service';
import { Event, EventCategory, EventLocation } from '../../../core/models/event.model';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-event-edit',
  templateUrl: './event-edit.page.html',
  styleUrls: ['./event-edit.page.scss'],
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
    IonModal,
    IonDatetime,
    IonSpinner
  ]
})
export class EventEditPage implements OnInit {
  // Injection des services
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly storageService = inject(StorageService);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  // État de la page
  eventId: string = '';
  originalEvent: Event | null = null;
  isLoading = true;

  // Formulaire
  eventForm!: FormGroup;
  
  // Image
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  hasImageChanged = false;

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
    addIcons({cameraOutline,closeOutline,calendarOutline,locationOutline,peopleOutline,warningOutline,checkmarkCircleOutline,lockClosedOutline,saveOutline});
  }

  ngOnInit() {
    // Récupère l'ID depuis l'URL
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

        this.originalEvent = event;
        this.imagePreview = event.imageUrl || null;
        this.initForm(event);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur chargement événement:', error);
        this.showToast('Erreur de chargement', 'danger');
        this.router.navigate(['/events']);
      }
    });
  }

  /**
   * Initialise le formulaire avec les données de l'événement
   */
  initForm(event: Event) {
    this.eventForm = this.fb.group({
      title: [event.title, [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: [event.description, [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      date: [event.date.toDate().toISOString(), Validators.required],
      category: [event.category, Validators.required],
      maxParticipants: [event.maxParticipants, [Validators.required, Validators.min(2), Validators.max(1000)]],
      isPrivate: [event.isPrivate],
      requiresApproval: [event.requiresApproval],
      // Location
      address: [event.location.address, Validators.required],
      city: [event.location.city, Validators.required],
      zipCode: [event.location.zipCode, [Validators.required, Validators.pattern(/^\d{5}$/)]]
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
    this.hasImageChanged = true;

    // Prévisualisation
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreview = e.target.result;
    };
    reader.readAsDataURL(file);

    console.log('✅ Nouvelle image sélectionnée:', file.name);
  }

  /**
   * Supprime l'image sélectionnée
   */
  removeImage() {
    this.selectedImage = null;
    this.imagePreview = null;
    this.hasImageChanged = true;
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
   * Vérifie si le formulaire a été modifié
   */
  hasChanges(): boolean {
    if (!this.originalEvent) return false;

    const formValue = this.eventForm.value;
    const original = this.originalEvent;

    return (
      formValue.title !== original.title ||
      formValue.description !== original.description ||
      formValue.date !== original.date.toDate().toISOString() ||
      formValue.category !== original.category ||
      formValue.maxParticipants !== original.maxParticipants ||
      formValue.isPrivate !== original.isPrivate ||
      formValue.requiresApproval !== original.requiresApproval ||
      formValue.address !== original.location.address ||
      formValue.city !== original.location.city ||
      formValue.zipCode !== original.location.zipCode ||
      this.hasImageChanged
    );
  }

  /**
   * Enregistre les modifications
   */
  async updateEvent() {
    if (this.eventForm.invalid) {
      await this.showToast('Veuillez remplir tous les champs correctement', 'warning');
      this.markFormGroupTouched(this.eventForm);
      return;
    }

    // Vérifie si des modifications ont été faites
    if (!this.hasChanges()) {
      await this.showToast('Aucune modification détectée', 'warning');
      return;
    }

    // Confirmation
    const alert = await this.alertCtrl.create({
      header: 'Confirmer les modifications',
      message: 'Voulez-vous enregistrer les modifications ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Enregistrer', handler: () => this.submitUpdate() }
      ]
    });
    await alert.present();
  }

  /**
   * Soumet la mise à jour à Firestore
   */
  private async submitUpdate() {
    const loading = await this.loadingCtrl.create({
      message: 'Mise à jour en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      let imageUrl = this.originalEvent?.imageUrl || '';

      // Upload de la nouvelle image si elle a changé
      if (this.selectedImage && this.hasImageChanged) {
        loading.message = 'Upload de l\'image...';
        
        // Supprime l'ancienne image si elle existe
        if (this.originalEvent?.imageUrl) {
          try {
            await this.storageService.deleteImage(this.originalEvent.imageUrl).toPromise();
            console.log('🗑️ Ancienne image supprimée');
          } catch (error) {
            console.warn('⚠️ Impossible de supprimer l\'ancienne image:', error);
          }
        }

        // Upload de la nouvelle image
        imageUrl = await this.storageService
          .uploadImageWithAutoName(this.selectedImage, 'events')
          .toPromise() || '';
      } else if (!this.imagePreview && this.hasImageChanged) {
        // L'utilisateur a supprimé l'image
        if (this.originalEvent?.imageUrl) {
          try {
            await this.storageService.deleteImage(this.originalEvent.imageUrl).toPromise();
            console.log('🗑️ Image supprimée');
          } catch (error) {
            console.warn('⚠️ Impossible de supprimer l\'image:', error);
          }
        }
        imageUrl = '';
      }

      // Prépare les données
      const formValue = this.eventForm.value;
      
      const location: EventLocation = {
        address: formValue.address,
        city: formValue.city,
        zipCode: formValue.zipCode,
        latitude: this.originalEvent?.location.latitude || 0,
        longitude: this.originalEvent?.location.longitude || 0
      };

      const updates = {
        title: formValue.title,
        description: formValue.description,
        date: Timestamp.fromDate(new Date(formValue.date)),
        location: location,
        maxParticipants: formValue.maxParticipants,
        category: formValue.category,
        imageUrl: imageUrl,
        isPrivate: formValue.isPrivate,
        requiresApproval: formValue.requiresApproval
      };

      // Met à jour l'événement dans Firestore
      loading.message = 'Enregistrement...';
      await this.eventsService.updateEvent(this.eventId, updates).toPromise();

      await loading.dismiss();
      await this.showToast('✅ Événement mis à jour avec succès !', 'success');

      // Redirige vers le détail
      this.router.navigate(['/events', this.eventId]);

    } catch (error: any) {
      await loading.dismiss();
      console.error('❌ Erreur mise à jour événement:', error);
      await this.showToast(
        error.message || 'Erreur lors de la mise à jour',
        'danger'
      );
    }
  }

  /**
   * Annule les modifications
   */
  async cancelEdit() {
    if (this.hasChanges()) {
      const alert = await this.alertCtrl.create({
        header: 'Annuler les modifications',
        message: 'Les modifications non enregistrées seront perdues. Continuer ?',
        buttons: [
          { text: 'Rester', role: 'cancel' },
          { 
            text: 'Quitter', 
            role: 'destructive',
            handler: () => this.router.navigate(['/events', this.eventId])
          }
        ]
      });
      await alert.present();
    } else {
      this.router.navigate(['/events', this.eventId]);
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