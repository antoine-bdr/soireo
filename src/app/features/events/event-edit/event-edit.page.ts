import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
  checkmarkCircleOutline,
  warningOutline, chevronForwardOutline, timeOutline } from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { StorageService } from '../../../core/services/storage.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { Event, EventCategory, EventLocation } from '../../../core/models/event.model';
import { Timestamp } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

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
export class EventEditPage implements OnInit, OnDestroy {
  // Injection des services
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly storageService = inject(StorageService);
  private readonly participantsService = inject(ParticipantsService);
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

  // ✅ Compteur de participants actuel (via ParticipantsService)
  currentParticipantCount = 0;

  // Gestion des subscriptions
  private subscriptions: Subscription[] = [];

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

  // Durées disponibles (après la définition des categories)
  durations = [
    { value: 1.5, label: '1h30' },
    { value: 2, label: '2 heures' },
    { value: 3, label: '3 heures' },      // Défaut
    { value: 4, label: '4 heures' },
    { value: 5, label: '5 heures' },
    { value: 6, label: '6 heures' },
    { value: 8, label: '8 heures' },
    { value: 10, label: '10 heures' },
    { value: 12, label: '12 heures' }
  ];

  // Heure de fin calculée (pour affichage)
  calculatedEndTime: string = '';

  constructor() {
    addIcons({cameraOutline,closeOutline,calendarOutline,chevronForwardOutline,locationOutline,peopleOutline,warningOutline,checkmarkCircleOutline,lockClosedOutline,saveOutline,timeOutline});
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
    console.log('🧹 EventEditPage destroyed - subscriptions cleaned');
  }

  /**
   * Charge l'événement depuis Firestore
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

        this.originalEvent = event;
        this.imagePreview = event.imageUrl || null;
        this.initForm(event);
        
        // Charge le compteur de participants actuel
        this.loadCurrentParticipantCount();
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur chargement événement:', error);
        this.showToast('Erreur de chargement', 'danger');
        this.router.navigate(['/events']);
      }
    });
    this.subscriptions.push(eventSub);
  }

  /**
   * ✅ Charge le nombre actuel de participants via ParticipantsService
   */
  loadCurrentParticipantCount() {
    const countSub = this.participantsService.getParticipantCount(this.eventId).subscribe({
      next: (count) => {
        this.currentParticipantCount = count;
        console.log(`✅ Participants actuels: ${count}`);
      },
      error: (error) => {
        console.error('❌ Erreur compteur participants:', error);
        this.currentParticipantCount = 0;
      }
    });
    this.subscriptions.push(countSub);
  }

  /**
   * Initialise le formulaire avec les données de l'événement
   */
  initForm(event: Event) {
    // Calculer la durée initiale si startTime et endTime existent
    let initialDuration = 3; // Défaut
    if (event.startTime && event.endTime) {
      const startMs = event.startTime.toDate().getTime();
      const endMs = event.endTime.toDate().getTime();
      initialDuration = (endMs - startMs) / (60 * 60 * 1000); // Convertir ms en heures
    }

    this.eventForm = this.fb.group({
      title: [event.title, [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: [event.description, [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      date: [event.date.toDate().toISOString(), Validators.required],
      duration: [initialDuration, Validators.required],
      category: [event.category, Validators.required],
      maxParticipants: [event.maxParticipants, [Validators.required, Validators.min(2), Validators.max(1000)]],
      isPrivate: [event.isPrivate],
      requiresApproval: [event.requiresApproval],
      // Location - ✅ Avec zipCode
      address: [event.location.address, Validators.required],
      city: [event.location.city, Validators.required],
      zipCode: [event.location.zipCode, [Validators.required, Validators.pattern(/^\d{5}$/)]]
    });

    // Écoute les changements pour recalculer l'heure de fin
    this.eventForm.get('date')?.valueChanges.subscribe(() => {
      this.updateCalculatedEndTime();
    });

    this.eventForm.get('duration')?.valueChanges.subscribe(() => {
      this.updateCalculatedEndTime();
    });

    // Calcul initial de l'heure de fin
    this.updateCalculatedEndTime();
  }

  /**
   * Calcule et met à jour l'heure de fin affichée
   */
  private updateCalculatedEndTime() {
    const dateValue = this.eventForm.get('date')?.value;
    const durationValue = this.eventForm.get('duration')?.value;

    if (!dateValue || !durationValue) {
      this.calculatedEndTime = '';
      return;
    }

    const startDate = new Date(dateValue);
    const endDate = new Date(startDate.getTime() + durationValue * 60 * 60 * 1000);

    this.calculatedEndTime = endDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Calcule la date de fin complète (pour Firestore)
   */
  private calculateEndDateTime(): Date | undefined {
    const dateValue = this.eventForm.get('date')?.value;
    const durationValue = this.eventForm.get('duration')?.value;

    if (!dateValue || !durationValue) {
      return undefined;
    }

    const startDate = new Date(dateValue);
    const endDate = new Date(startDate.getTime() + durationValue * 60 * 60 * 1000);

    return endDate;
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

    // Calculer la durée originale
    let originalDuration = 3;
    if (original.startTime && original.endTime) {
      const startMs = original.startTime.toDate().getTime();
      const endMs = original.endTime.toDate().getTime();
      originalDuration = (endMs - startMs) / (60 * 60 * 1000);
    }

    return (
      formValue.title !== original.title ||
      formValue.description !== original.description ||
      formValue.date !== original.date.toDate().toISOString() ||
      formValue.duration !== originalDuration ||
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

    if (!this.hasChanges()) {
      await this.showToast('Aucune modification détectée', 'warning');
      return;
    }

    // ✅ VALIDATION : Empêche de réduire sous le nombre actuel de participants
    const newMaxParticipants = this.eventForm.value.maxParticipants;
    if (newMaxParticipants < this.currentParticipantCount) {
      const alert = await this.alertCtrl.create({
        header: '⚠️ Impossible de réduire',
        message: `Vous ne pouvez pas réduire le nombre de participants à ${newMaxParticipants} car il y a déjà ${this.currentParticipantCount} participants inscrits.\n\nVous devez d'abord retirer des participants ou augmenter la limite.`,
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmer les modifications',
      message: 'Voulez-vous enregistrer les modifications ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { 
          text: 'Enregistrer', 
          handler: () => this.saveChanges()
        }
      ]
    });
    await alert.present();
  }

  /**
   * ✅ Enregistre les modifications (VERSION CORRIGÉE)
   */
  private async saveChanges() {
    const loading = await this.loadingCtrl.create({
      message: 'Mise à jour...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      let imageUrl = this.originalEvent?.imageUrl || '';

      // ✅ FIX : Utilisation de uploadImagePromise
      if (this.selectedImage && this.hasImageChanged) {
        const path = `events/${this.eventId}/${Date.now()}_${this.selectedImage.name}`;
        imageUrl = await this.storageService.uploadImagePromise(this.selectedImage, path);
        console.log('✅ Nouvelle image uploadée:', imageUrl);
      }

      // Prépare les données
      const formValue = this.eventForm.value;
      
      // Calcul de startTime et endTime
      const startDate = new Date(formValue.date);
      const endDate = this.calculateEndDateTime();

      const updates: Partial<Event> = {
        title: formValue.title,
        description: formValue.description,
        date: Timestamp.fromDate(startDate),
        startTime: Timestamp.fromDate(startDate),
        endTime: endDate ? Timestamp.fromDate(endDate) : undefined,
        category: formValue.category,
        maxParticipants: formValue.maxParticipants,
        isPrivate: formValue.isPrivate,
        requiresApproval: formValue.requiresApproval,
        location: {
          address: formValue.address,
          city: formValue.city,
          zipCode: formValue.zipCode // ✅ zipCode inclus
        } as EventLocation,
        imageUrl
      };

      // Met à jour dans Firestore
      await this.eventsService.updateEvent(this.eventId, updates).toPromise();
      
      await loading.dismiss();
      await this.showToast('Événement mis à jour avec succès', 'success');

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
  get duration() { return this.eventForm.get('duration'); }
  get category() { return this.eventForm.get('category'); }
  get maxParticipants() { return this.eventForm.get('maxParticipants'); }
  get address() { return this.eventForm.get('address'); }
  get city() { return this.eventForm.get('city'); }
  get zipCode() { return this.eventForm.get('zipCode'); }
  get isPrivate() { return this.eventForm.get('isPrivate'); }
  get requiresApproval() { return this.eventForm.get('requiresApproval'); }
}