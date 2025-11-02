// src/app/features/events/event-create/event-create.page.ts
// ✅ VERSION SIMPLIFIÉE : Visibilité automatique selon requiresApproval
// ✅ AJOUT : Sélection visuelle du type d'événement

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
  AlertController,
  IonList,
  IonSpinner,
  IonChip,     // ✅ AJOUTÉ pour les chips use-cases
  IonBadge     // ✅ AJOUTÉ pour le badge "Recommandé"
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
  chevronForwardOutline, 
  searchOutline, 
  checkmarkCircle,
  // ✅ AJOUTÉS pour les types d'événements
  mailOutline,
  globeOutline,
  shieldCheckmarkOutline,
  alertCircleOutline,
  informationCircleOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { StorageService } from '../../../core/services/storage.service';
import { EventLocationVisibilityService } from '../../../core/services/event-location-visibility.service';
import { CreateEventDto, EventCategory, EventLocation, AddressVisibility } from '../../../core/models/event.model';

import { FormsModule } from '@angular/forms';
import { GooglePlacesService, AddressPrediction, PlaceDetails } from '../../../core/services/google-places.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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
    IonModal,
    IonDatetime,
    IonList,
    IonSpinner,
    FormsModule,
    IonChip,    // ✅ AJOUTÉ
    IonBadge    // ✅ AJOUTÉ
  ]
})
export class EventCreatePage implements OnInit, OnDestroy {
  // Injection des services
  private readonly fb = inject(FormBuilder);
  private readonly eventsService = inject(EventsService);
  private readonly storageService = inject(StorageService);
  private readonly locationVisibilityService = inject(EventLocationVisibilityService);
  private readonly router = inject(Router);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly googlePlacesService = inject(GooglePlacesService);

  // Formulaire
  eventForm!: FormGroup;
  
  // Image
  selectedImage: File | null = null;
  imagePreview: string | null = null;

  // Date minimale (aujourd'hui)
  minDate: string = new Date().toISOString();

  // ✅ AJOUTÉ : Type d'événement sélectionné (par défaut "Sur invitation")
  selectedEventType: 'invitation' | 'public' | 'private' = 'invitation';

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

  // Google Places Autocomplete
  isGoogleMapsLoaded = false;
  addressSearchTerm = '';
  addressPredictions: AddressPrediction[] = [];
  selectedPlaceDetails: PlaceDetails | null = null;
  isSearching = false;
  submitted = false;
  
  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({
      cameraOutline,
      closeOutline,
      calendarOutline,
      chevronForwardOutline,
      locationOutline,
      searchOutline,
      checkmarkCircle,
      peopleOutline,
      checkmarkCircleOutline,
      lockClosedOutline,
      saveOutline,
      // ✅ AJOUTÉS
      mailOutline,
      globeOutline,
      shieldCheckmarkOutline,
      alertCircleOutline,
      informationCircleOutline
    });
  }

  ngOnInit() {
    this.initForm();
    this.setupGoogleMaps();
    this.setupAddressSearch();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub?.unsubscribe());
    this.searchSubject.complete();
  }

  /**
   * Initialise le formulaire avec validation
   * ℹ️ PAS de champ addressVisibility - géré automatiquement
   * ✅ MODIFIÉ : requiresApproval par défaut à true (Sur invitation)
   */
  initForm() {
    this.eventForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      date: ['', Validators.required],
      category: [EventCategory.PARTY, Validators.required],
      maxParticipants: [10, [Validators.required, Validators.min(2), Validators.max(1000)]],
      isPrivate: [false],
      requiresApproval: [true] // ✅ MODIFIÉ : true par défaut (Sur invitation)
    });
  }

  // ========================================
  // ✅ NOUVELLES MÉTHODES : Gestion du type d'événement
  // ========================================

  /**
   * ✅ NOUVEAU : Sélectionne le type d'événement
   */
  async selectEventType(type: 'invitation' | 'public' | 'private') {
    // Si l'utilisateur sélectionne "Public", affiche une confirmation
    if (type === 'public') {
      const confirmed = await this.confirmPublicEvent();
      if (!confirmed) {
        return; // L'utilisateur a annulé
      }
    }
    
    this.selectedEventType = type;
    
    // Met à jour les valeurs du formulaire
    switch (type) {
      case 'invitation':
        this.eventForm.patchValue({
          requiresApproval: true,
          isPrivate: false
        });
        break;
        
      case 'public':
        this.eventForm.patchValue({
          requiresApproval: false,
          isPrivate: false
        });
        break;
        
      case 'private':
        this.eventForm.patchValue({
          requiresApproval: true,
          isPrivate: true
        });
        break;
    }
    
    console.log(`🎭 Type d'événement sélectionné: ${type}`, this.eventForm.value);
  }

  /**
   * ✅ NOUVEAU : Affiche une alerte de confirmation pour les événements publics
   */
  async confirmPublicEvent(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: '🌍 Événement public',
        message: `
          <p>Les utilisateurs pourront rejoindre <strong>sans validation</strong>.</p>
          <p>Ce mode est recommandé pour les <strong>événements professionnels</strong> uniquement.</p>
          <br>
          <p>💡 <strong>Conseil :</strong> Pour une soirée entre particuliers, choisis plutôt "Sur invitation".</p>
        `,
        buttons: [
          {
            text: 'Annuler',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: 'Confirmer',
            handler: () => resolve(true)
          }
        ]
      });
      
      await alert.present();
    });
  }

  // ========================================
  // MÉTHODES EXISTANTES (inchangées)
  // ========================================

  setupGoogleMaps() {
    const sub = this.googlePlacesService.isReady().subscribe(ready => {
      this.isGoogleMapsLoaded = ready;
      if (ready) {
        console.log('✅ Google Maps prêt pour l\'autocomplete');
      }
    });
    this.subscriptions.push(sub);
  }
  
  setupAddressSearch() {
    const sub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(searchTerm => {
        this.performAddressSearch(searchTerm);
      });
    
    this.subscriptions.push(sub);
  }
  
  onAddressSearch(event: any) {
    const value = event.detail.value || '';
    this.searchSubject.next(value);
  }

  performAddressSearch(searchTerm: string) {
    if (!searchTerm || searchTerm.length < 3) {
      this.addressPredictions = [];
      return;
    }
  
    this.isSearching = true;
  
    this.googlePlacesService.getAddressPredictions(searchTerm).subscribe({
      next: (predictions) => {
        this.addressPredictions = predictions;
        this.isSearching = false;
        console.log('📍 Prédictions reçues:', predictions.length);
      },
      error: (error) => {
        console.error('❌ Erreur autocomplete:', error);
        this.addressPredictions = [];
        this.isSearching = false;
        
        if (error.status === 'OVER_QUERY_LIMIT') {
          this.showToast('Limite de requêtes atteinte, réessayez plus tard', 'warning');
        } else if (error.status === 'REQUEST_DENIED') {
          this.showToast('Erreur de configuration Google Maps', 'danger');
        }
      }
    });
  }
  
  async selectAddress(prediction: AddressPrediction) {
    console.log('📍 Adresse sélectionnée:', prediction.description);
  
    const loading = await this.loadingCtrl.create({
      message: 'Récupération des détails...',
      spinner: 'dots',
      duration: 5000
    });
    await loading.present();
  
    this.googlePlacesService.getPlaceDetails(prediction.placeId).subscribe({
      next: (details) => {
        this.selectedPlaceDetails = details;
        this.addressSearchTerm = prediction.description;
        this.addressPredictions = [];
        loading.dismiss();
        console.log('✅ Détails récupérés:', details);
      },
      error: (error) => {
        console.error('❌ Erreur récupération détails:', error);
        loading.dismiss();
        this.showToast('Impossible de récupérer les détails de l\'adresse', 'danger');
      }
    });
  }
  
  clearAddress() {
    this.selectedPlaceDetails = null;
    this.addressSearchTerm = '';
    this.addressPredictions = [];
  }

  async onImageSelected(event: any) {
    const file = event.target.files[0];
    
    if (!file) return;

    if (!this.storageService.isValidImage(file)) {
      await this.showToast('Seules les images (JPG, PNG, GIF, WebP) sont acceptées', 'warning');
      return;
    }

    if (!this.storageService.isValidSize(file, 5)) {
      await this.showToast('L\'image ne doit pas dépasser 5MB', 'warning');
      return;
    }

    this.selectedImage = file;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreview = e.target.result;
    };
    reader.readAsDataURL(file);

    console.log('✅ Image sélectionnée:', file.name);
  }

  removeImage() {
    this.selectedImage = null;
    this.imagePreview = null;
  }

  onDateChange(event: any) {
    const selectedDate = event.detail.value;
    this.eventForm.patchValue({ date: selectedDate });
  }

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

  async createEvent() {
    this.submitted = true;

    if (this.eventForm.invalid) {
      await this.showToast('Veuillez remplir tous les champs correctement', 'warning');
      this.markFormGroupTouched(this.eventForm);
      return;
    }

    if (!this.selectedPlaceDetails) {
      await this.showToast('Veuillez sélectionner une adresse dans la liste', 'warning');
      return;
    }

    if (this.selectedPlaceDetails.latitude === undefined || 
        this.selectedPlaceDetails.latitude === null ||
        this.selectedPlaceDetails.longitude === undefined || 
        this.selectedPlaceDetails.longitude === null) {
      
      console.error('❌ Coordonnées GPS manquantes:', this.selectedPlaceDetails);
      await this.showToast('Les coordonnées GPS de l\'adresse sont manquantes.', 'danger');
      this.clearAddress();
      return;
    }

    if (typeof this.selectedPlaceDetails.latitude !== 'number' || 
        typeof this.selectedPlaceDetails.longitude !== 'number' ||
        isNaN(this.selectedPlaceDetails.latitude) ||
        isNaN(this.selectedPlaceDetails.longitude)) {
      
      console.error('❌ Coordonnées GPS invalides:', this.selectedPlaceDetails);
      await this.showToast('Les coordonnées GPS sont invalides.', 'danger');
      this.clearAddress();
      return;
    }

    console.log('✅ Validation GPS réussie');

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

  private async submitEvent() {
    const loading = await this.loadingCtrl.create({
      message: 'Création de l\'événement...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      let imageUrl = '';

      if (this.selectedImage) {
        loading.message = 'Upload de l\'image...';
        imageUrl = await this.storageService
          .uploadImageWithAutoName(this.selectedImage, 'events')
          .toPromise() || '';
      }

      const formValue = this.eventForm.value;
      
      const visibility = formValue.requiresApproval 
        ? AddressVisibility.PARTICIPANTS_ONLY
        : AddressVisibility.PUBLIC;

      console.log('🔒 Approbation requise:', formValue.requiresApproval);
      console.log('🔒 Visibilité automatique:', visibility);
      
      let location: EventLocation = {
        address: this.selectedPlaceDetails!.address,
        city: this.selectedPlaceDetails!.city,
        zipCode: this.selectedPlaceDetails!.zipCode,
        latitude: this.selectedPlaceDetails!.latitude,
        longitude: this.selectedPlaceDetails!.longitude,
        country: this.selectedPlaceDetails!.country,
        placeId: this.selectedPlaceDetails!.placeId,
        visibility: visibility
      };

      if (visibility === AddressVisibility.PARTICIPANTS_ONLY) {
        const approximate = this.locationVisibilityService.calculateApproximateCoordinates(
          this.selectedPlaceDetails!.latitude,
          this.selectedPlaceDetails!.longitude
        );

        location.approximateLatitude = approximate.approximateLatitude;
        location.approximateLongitude = approximate.approximateLongitude;

        console.log('📍 Coordonnées approximatives calculées:', approximate);
        console.log('ℹ️ L\'adresse sera masquée pour les non-participants');
      }

      console.log('📍 Location finale:', location);

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
        tags: []
      };

      loading.message = 'Enregistrement...';
      const eventId = await this.eventsService.createEvent(eventData).toPromise();

      await loading.dismiss();
      await this.showToast('🎉 Événement créé avec succès !', 'success');

      this.router.navigate(['/tabs/events', eventId]);

    } catch (error: any) {
      await loading.dismiss();
      console.error('❌ Erreur création événement:', error);
      await this.showToast(
        error.message || 'Erreur lors de la création de l\'événement',
        'danger'
      );
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  get title() { return this.eventForm.get('title'); }
  get description() { return this.eventForm.get('description'); }
  get date() { return this.eventForm.get('date'); }
  get category() { return this.eventForm.get('category'); }
  get maxParticipants() { return this.eventForm.get('maxParticipants'); }
  get isPrivate() { return this.eventForm.get('isPrivate'); }
  get requiresApproval() { return this.eventForm.get('requiresApproval'); }
  
  get isFormValid(): boolean {
    return this.eventForm.valid && 
           this.selectedPlaceDetails !== null &&
           this.selectedPlaceDetails.latitude !== undefined &&
           this.selectedPlaceDetails.longitude !== undefined;
  }
}