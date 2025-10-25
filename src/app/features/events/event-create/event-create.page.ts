// src/app/features/events/event-create/event-create.page.ts
// ✅ CORRIGÉ : Validation que latitude/longitude existent avant l'envoi

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
  checkmarkCircle 
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { StorageService } from '../../../core/services/storage.service';
import { CreateEventDto, EventCategory, EventLocation } from '../../../core/models/event.model';

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
    FormsModule
  ]
})
export class EventCreatePage implements OnInit, OnDestroy {
  // Injection des services
  private readonly fb = inject(FormBuilder);
  private readonly eventsService = inject(EventsService);
  private readonly storageService = inject(StorageService);
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
      saveOutline
    });
  }

  ngOnInit() {
    this.initForm();
    this.setupGoogleMaps();
    this.setupAddressSearch();
  }

  ngOnDestroy() {
    // Nettoyage des subscriptions pour éviter les memory leaks
    this.subscriptions.forEach(sub => sub?.unsubscribe());
    this.searchSubject.complete();
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
      requiresApproval: [false]
    });
  }

  /**
   * Configure Google Maps
   */
  setupGoogleMaps() {
    const sub = this.googlePlacesService.isReady().subscribe(ready => {
      this.isGoogleMapsLoaded = ready;
      if (ready) {
        console.log('✅ Google Maps prêt pour l\'autocomplete');
      }
    });
    this.subscriptions.push(sub);
  }
  
  /**
   * Configure la recherche d'adresse avec debounce
   */
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
  
  /**
   * Gestion de la saisie dans le champ d'adresse
   */
  onAddressSearch(event: any) {
    const value = event.detail.value || '';
    this.searchSubject.next(value);
  }

  /**
   * Effectue la recherche d'adresses
   */
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
        console.log('🔍 Prédictions reçues:', predictions.length);
      },
      error: (error) => {
        console.error('❌ Erreur autocomplete:', error);
        this.addressPredictions = [];
        this.isSearching = false;
        
        // Message d'erreur utilisateur
        if (error.status === 'OVER_QUERY_LIMIT') {
          this.showToast('Limite de requêtes atteinte, réessayez plus tard', 'warning');
        } else if (error.status === 'REQUEST_DENIED') {
          this.showToast('Erreur de configuration Google Maps', 'danger');
        }
      }
    });
  }
  
  /**
   * Sélection d'une adresse dans les suggestions
   */
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
        loading.dismiss();
        
        this.selectedPlaceDetails = details;
        this.addressSearchTerm = details.formattedAddress;
        this.addressPredictions = [];
        
        console.log('✅ Détails de l\'adresse:', details);
        console.log(`📍 Coordonnées: ${details.latitude}, ${details.longitude}`);
        
        this.showToast('✅ Adresse confirmée', 'success');
      },
      error: (error) => {
        loading.dismiss();
        console.error('❌ Erreur détails place:', error);
        this.showToast('Erreur lors de la récupération des détails', 'danger');
      }
    });
  }
  
  /**
   * Efface l'adresse sélectionnée
   */
  clearAddress() {
    this.selectedPlaceDetails = null;
    this.addressSearchTerm = '';
    this.addressPredictions = [];
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
   * ✅ CORRIGÉ : Validation incluant selectedPlaceDetails ET coordonnées GPS
   */
  async createEvent() {
    this.submitted = true;

    // Validation du formulaire
    if (this.eventForm.invalid) {
      await this.showToast('Veuillez remplir tous les champs correctement', 'warning');
      this.markFormGroupTouched(this.eventForm);
      return;
    }

    // ✅ Vérification qu'une adresse a été sélectionnée
    if (!this.selectedPlaceDetails) {
      await this.showToast('Veuillez sélectionner une adresse dans la liste', 'warning');
      return;
    }

    // ✅ NOUVEAU : Vérification que les coordonnées GPS existent
    if (this.selectedPlaceDetails.latitude === undefined || 
        this.selectedPlaceDetails.latitude === null ||
        this.selectedPlaceDetails.longitude === undefined || 
        this.selectedPlaceDetails.longitude === null) {
      
      console.error('❌ Coordonnées GPS manquantes:', this.selectedPlaceDetails);
      await this.showToast('Les coordonnées GPS de l\'adresse sont manquantes. Veuillez sélectionner une autre adresse.', 'danger');
      this.clearAddress();
      return;
    }

    // ✅ NOUVEAU : Vérification que les coordonnées GPS sont des nombres valides
    if (typeof this.selectedPlaceDetails.latitude !== 'number' || 
        typeof this.selectedPlaceDetails.longitude !== 'number' ||
        isNaN(this.selectedPlaceDetails.latitude) ||
        isNaN(this.selectedPlaceDetails.longitude)) {
      
      console.error('❌ Coordonnées GPS invalides:', this.selectedPlaceDetails);
      await this.showToast('Les coordonnées GPS sont invalides. Veuillez sélectionner une autre adresse.', 'danger');
      this.clearAddress();
      return;
    }

    console.log('✅ Validation GPS réussie:', {
      latitude: this.selectedPlaceDetails.latitude,
      longitude: this.selectedPlaceDetails.longitude
    });

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
   * ✅ CORRIGÉ : Les coordonnées GPS sont maintenant garanties d'exister
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
      
      // ✅ Construction de l'objet location avec coordonnées GPS GARANTIES
      const location: EventLocation = {
        address: this.selectedPlaceDetails!.address,
        city: this.selectedPlaceDetails!.city,
        zipCode: this.selectedPlaceDetails!.zipCode,
        latitude: this.selectedPlaceDetails!.latitude,   // ✅ Garanti d'être un number
        longitude: this.selectedPlaceDetails!.longitude, // ✅ Garanti d'être un number
        country: this.selectedPlaceDetails!.country,
        placeId: this.selectedPlaceDetails!.placeId
      };

      console.log('📝 Objet location à envoyer:', location);

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

      // Crée l'événement dans Firestore
      loading.message = 'Enregistrement...';
      const eventId = await this.eventsService.createEvent(eventData).toPromise();

      await loading.dismiss();
      await this.showToast('🎉 Événement créé avec succès !', 'success');

      // Redirige vers le détail de l'événement
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
  get isPrivate() { return this.eventForm.get('isPrivate'); }
  get requiresApproval() { return this.eventForm.get('requiresApproval'); }
  
  /**
   * ✅ Getter pour vérifier si le formulaire est valide ET qu'une adresse avec GPS est sélectionnée
   */
  get isFormValid(): boolean {
    return this.eventForm.valid && 
           this.selectedPlaceDetails !== null &&
           this.selectedPlaceDetails.latitude !== undefined &&
           this.selectedPlaceDetails.longitude !== undefined;
  }
}