// src/app/features/events/event-create/event-create.page.ts
// ✅ VERSION AVEC DURÉE D'ÉVÉNEMENT
// Modification : Ajout de la durée et calcul automatique de l'heure de fin

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
  ModalController, 
  IonList,
  IonSpinner,
  IonChip,
  IonBadge,
  IonAvatar
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
  mailOutline,
  globeOutline,
  shieldCheckmarkOutline,
  alertCircleOutline,
  informationCircleOutline,
  timeOutline,  // ✅ AJOUTÉ pour l'icône de durée
  personAddOutline,
  closeCircle
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { StorageService } from '../../../core/services/storage.service';
import { EventLocationVisibilityService } from '../../../core/services/event-location-visibility.service';
import { CreateEventDto, EventCategory, EventLocation, AddressVisibility, EventAccessType } from '../../../core/models/event.model';
import { InvitationsService } from '../../../core/services/invitations.service';
import { InviteFriendsModalComponent } from '../../../shared/components/invite-friends-modal/invite-friends-modal.component';

import { FormsModule } from '@angular/forms';
import { GooglePlacesService, AddressPrediction, PlaceDetails } from '../../../core/services/google-places.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';

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
    IonText,
    IonModal,
    IonDatetime,
    IonList,
    IonSpinner,
    FormsModule,
    IonChip,       // ✅ AJOUTER
    IonBadge,      // ✅ AJOUTER
    IonAvatar      // ✅ AJOUTER (pour les chips)
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
  private readonly invitationsService = inject(InvitationsService);
  private readonly modalCtrl = inject(ModalController);

  // Formulaire
  eventForm!: FormGroup;
  
  // Image
  selectedImage: File | null = null;
  imagePreview: string | null = null;

  // Date minimale (aujourd'hui)
  minDate: string = new Date().toISOString();

  // Type d'événement sélectionné (par défaut "Sur invitation")
  accessType: EventAccessType = EventAccessType.PRIVATE;
  selectedFriends: Array<{ userId: string; displayName: string; photoURL?: string }> = [];
  invitedFriendsCount: number = 0;
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

  // ✅ Durées disponibles
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

  // ✅ Heure de fin calculée (pour affichage)
  calculatedEndTime: string = '';

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
      mailOutline,
      globeOutline,
      shieldCheckmarkOutline,
      alertCircleOutline,
      informationCircleOutline,
      timeOutline,
      personAddOutline,  // ✅ AJOUTER
      closeCircle    // ✅ AJOUTÉ
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
   * ✅ MODIFIÉ : Ajout du champ 'duration' avec valeur par défaut 3 heures
   */
  initForm() {
    this.eventForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      date: ['', Validators.required],
      duration: [3, Validators.required],  // ✅ AJOUTÉ : Durée par défaut = 3 heures
      category: [EventCategory.PARTY, Validators.required],
      maxParticipants: [10, [Validators.required, Validators.min(2), Validators.max(1000)]],
      accessType: [EventAccessType.PRIVATE, Validators.required], // ✅ Utilise EventAccessType
      requiresApproval: [true]
    });

    // ✅ Écoute les changements de date et durée pour calculer l'heure de fin
    this.eventForm.get('date')?.valueChanges.subscribe(() => {
      this.updateCalculatedEndTime();
    });

    this.eventForm.get('duration')?.valueChanges.subscribe(() => {
      this.updateCalculatedEndTime();
    });
  }

  // ========================================
  // ✅ NOUVELLES MÉTHODES : Gestion de la durée
  // ========================================

  /**
   * ✅ NOUVEAU : Calcule et met à jour l'heure de fin affichée
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

    console.log('⏰ Heure de début:', startDate.toISOString());
    console.log('⏰ Durée:', durationValue, 'heures');
    console.log('⏰ Heure de fin calculée:', this.calculatedEndTime, '(' + endDate.toISOString() + ')');
  }

  /**
   * ✅ NOUVEAU : Calcule la date de fin complète (pour Firestore)
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

  // ========================================
  // GOOGLE MAPS & AUTOCOMPLETE
  // ✅ CODE ORIGINAL - PAS DE MODIFICATION
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

  // ========================================
  // GESTION IMAGE
  // ========================================

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

  // ========================================
  // GESTION DATE
  // ========================================

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

  // ========================================
  // CRÉATION DE L'ÉVÉNEMENT
  // ========================================

  async createEvent() {
    this.submitted = true;

    if (this.eventForm.invalid) {
      await this.showToast('Veuillez remplir tous les champs correctement', 'warning');
      this.markFormGroupTouched(this.eventForm);
      return;
    }

    if (this.accessType === EventAccessType.INVITE_ONLY && this.selectedFriends.length === 0) {
      await this.showToast('Vous devez inviter au moins 1 ami pour un événement sur invitation uniquement', 'warning');
      return;
    }
    
    console.log('🔍 Validation accessType:', {
      type: this.accessType,
      isInviteOnly: this.accessType === EventAccessType.INVITE_ONLY,
      friendsSelected: this.selectedFriends.length
    });

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

  /**
   * ✅ MODIFIÉ : Ajout de startTime et endTime dans le DTO
   */
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
  
      if (!this.selectedPlaceDetails?.latitude || !this.selectedPlaceDetails?.longitude) {
        throw new Error('Coordonnées GPS manquantes');
      }
  
      const eventDate = new Date(formValue.date);
      let startTime: Date | undefined;
      let endTime: Date | undefined;
  
      if (formValue.startTime) {
        const [hours, minutes] = formValue.startTime.split(':');
        startTime = new Date(eventDate);
        startTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      }
  
      if (formValue.duration && startTime) {
        endTime = new Date(startTime);
        const [hours, minutes] = formValue.duration.split(':');
        endTime.setHours(
          endTime.getHours() + parseInt(hours, 10),
          endTime.getMinutes() + parseInt(minutes, 10)
        );
      }
  
      const eventData: CreateEventDto = {
        title: formValue.title,
        description: formValue.description,
        date: eventDate,
        ...(startTime && { startTime }),  // ✅ N'inclut que si défini
        ...(endTime && { endTime }),      // ✅ N'inclut que si défini
        location: {
          address: this.selectedPlaceDetails.address,
          city: this.selectedPlaceDetails.city || '',
          zipCode: this.selectedPlaceDetails.zipCode || '',
          latitude: this.selectedPlaceDetails.latitude,
          longitude: this.selectedPlaceDetails.longitude,
          visibility: AddressVisibility.PARTICIPANTS_ONLY
        },
        category: formValue.category,
        maxParticipants: formValue.maxParticipants,
        imageUrl: imageUrl,
        accessType: this.accessType,
        requiresApproval: formValue.requiresApproval,
        tags: []
      };
  
      loading.message = 'Enregistrement...';
      const eventId = await this.eventsService.createEvent(eventData).toPromise();
  
      console.log('✅ Événement créé avec ID:', eventId);
      console.log('🔍 AccessType:', this.accessType);
      console.log('🔍 Amis sélectionnés:', this.selectedFriends.length);
  
      // ✅ MODIFIÉ : Envoyer les invitations si des amis ont été sélectionnés (pour TOUS les types)
      if (this.selectedFriends.length > 0 && eventId) {
        console.log(`📨 Envoi de ${this.selectedFriends.length} invitation(s)...`);
        loading.message = `Envoi des invitations...`;
        
        try {
          const friendIds = this.selectedFriends.map(f => f.userId);
          const friendsData = new Map(
            this.selectedFriends.map(f => [
              f.userId,
              { name: f.displayName, photo: f.photoURL }
            ])
          );
  
          // Charger l'événement complet pour les invitations
          const createdEvent = await this.eventsService.getEventById(eventId).pipe(take(1)).toPromise();
          
          if (createdEvent) {
            console.log('✅ Événement chargé:', createdEvent.title);
            
            const sentCount = await this.invitationsService.sendInvitations(
              eventId,
              createdEvent,
              friendIds,
              friendsData
            );
            
            console.log(`✅ ${sentCount} invitation(s) envoyée(s)`);
            
            await loading.dismiss();
            
            // ✅ Toast spécifique pour les invitations
            await this.showToast(
              `🎉 Événement créé ! ${sentCount} invitation(s) envoyée(s)`,
              'success'
            );
          } else {
            console.error('❌ Événement non trouvé après création');
            await loading.dismiss();
            await this.showToast('⚠️ Événement créé mais invitations non envoyées', 'warning');
          }
        } catch (inviteError) {
          console.error('❌ Erreur envoi invitations (événement créé):', inviteError);
          await loading.dismiss();
          await this.showToast(
            '⚠️ Événement créé mais erreur lors de l\'envoi des invitations',
            'warning'
          );
        }
      } else {
        // ✅ Pas d'invitations à envoyer
        await loading.dismiss();
        await this.showToast('🎉 Événement créé avec succès !', 'success');
        
        console.log('ℹ️ Pas d\'invitations à envoyer:', {
          accessType: this.accessType,
          friendsCount: this.selectedFriends.length
        });
      }
  
      // ✅ Redirection vers la liste des événements
      this.router.navigate(['/tabs/my-events']);
  
    } catch (error: any) {
      await loading.dismiss();
      console.error('❌ Erreur création événement:', error);
      await this.showToast(
        error.message || 'Erreur lors de la création de l\'événement',
        'danger'
      );
    }
  }

  // ========================================
  // HELPERS
  // ========================================

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

  // ========================================
  // GETTERS
  // ========================================
  get accessTypeEnum() { return EventAccessType; }
  get title() { return this.eventForm.get('title'); }
  get description() { return this.eventForm.get('description'); }
  get date() { return this.eventForm.get('date'); }
  get duration() { return this.eventForm.get('duration'); }  // ✅ AJOUTÉ
  get category() { return this.eventForm.get('category'); }
  get maxParticipants() { return this.eventForm.get('maxParticipants'); }
  get requiresApproval() { return this.eventForm.get('requiresApproval'); }
  
  get isFormValid(): boolean {
    return this.eventForm.valid && 
           this.selectedPlaceDetails !== null &&
           this.selectedPlaceDetails.latitude !== undefined &&
           this.selectedPlaceDetails.longitude !== undefined;
  }

  // ========================================
  // ✅ NOUVEAU : Gestion du type d'accès
  // ========================================

  /**
   * Change le type d'accès de l'événement
   */
  selectAccessType(type: EventAccessType) {
    this.accessType = type;
    this.eventForm.patchValue({ accessType: type });
    
    // ✅ Si on passe à PUBLIC ou PRIVATE, vider les invités
    if (type !== EventAccessType.INVITE_ONLY) {
      this.selectedFriends = [];
      this.invitedFriendsCount = 0;
    }
    
    console.log('📋 Type d\'accès changé:', type);
  }

  /**
   * ✅ Ouvre la modal pour inviter des amis
   */
  async openInviteFriendsModal() {
    const modal = await this.modalCtrl.create({
      component: InviteFriendsModalComponent,
      componentProps: {
        event: null, // ✅ Pas encore créé
        currentParticipants: [] // ✅ Aucun participant pour l'instant
      }
    });
  
    await modal.present();
  
    const { data } = await modal.onWillDismiss();
    
    // ✅ Gérer le retour des amis sélectionnés
    if (data && data.selectedFriends && Array.isArray(data.selectedFriends)) {
      this.selectedFriends = data.selectedFriends;
      this.invitedFriendsCount = this.selectedFriends.length;
      console.log(`✅ ${this.invitedFriendsCount} ami(s) sélectionné(s) pour invitation`);
      console.log('👥 Amis sélectionnés:', this.selectedFriends);
    }
  }

  /**
   * ✅ Retire un ami de la liste des invités
   */
  removeFriend(userId: string) {
    this.selectedFriends = this.selectedFriends.filter(f => f.userId !== userId);
    this.invitedFriendsCount = this.selectedFriends.length;
  }
  
}