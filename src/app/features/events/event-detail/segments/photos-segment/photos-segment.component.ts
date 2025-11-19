import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonCard, IonCardContent, IonButton, IonIcon, IonSpinner, IonFab, IonFabButton,
  IonGrid, IonRow, IonCol, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonContent as IonModalContent,
  AlertController, ActionSheetController, ToastController, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cameraOutline, imagesOutline, addOutline, trashOutline, downloadOutline,
  closeOutline, expandOutline, chevronBackOutline, chevronForwardOutline, ellipsisVertical } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';

import { EventWithConditionalLocation, EventPhoto, Event } from '../../../../../core/models/event.model';
import { EventsService } from '../../../../../core/services/events.service';
import { StorageService } from '../../../../../core/services/storage.service';
import { AuthenticationService } from '../../../../../core/services/authentication.service';
import { AddressDisplayInfo, EventPermissions } from 'src/app/core/models/event-permissions.model';

@Component({
  selector: 'app-photos-segment',
  templateUrl: './photos-segment.component.html',
  styleUrls: ['./photos-segment.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, IonCard, IonCardContent, IonButton, IonIcon, IonSpinner, IonFab, IonFabButton,
    IonGrid, IonRow, IonCol, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonModalContent
  ]
})
export class PhotosSegmentComponent implements OnInit, OnDestroy {
  @Input() eventId!: string;
  @Input() event!: EventWithConditionalLocation;
  @Output() photoCountChanged = new EventEmitter<number>();
  @Output() eventUpdated = new EventEmitter<void>();

  @Input() permissions!: EventPermissions;
  @Input() isReadOnly = false;

  photos: EventPhoto[] = [];
  isLoading = true;
  isUploading = false;
  currentUserId: string | null = null;
  
  showLightbox = false;
  currentPhotoIndex = 0;
  
  private destroy$ = new Subject<void>();

  constructor(
    private eventsService: EventsService,
    private storageService: StorageService,
    private authService: AuthenticationService,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private toastController: ToastController,
    private modalCtrl: ModalController
  ) {
    addIcons({imagesOutline,cameraOutline,ellipsisVertical,addOutline,closeOutline,chevronBackOutline,chevronForwardOutline,downloadOutline,trashOutline,expandOutline});
  }

  async ngOnInit() {
    console.log('📸 PhotosSegment initialized');
    
    this.authService.getUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUserId = user?.uid || null;
      });
    
    this.loadPhotos();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPhotos() {
    this.isLoading = true;
    
    const originalEvent = this.event as any;
    if (originalEvent?.eventPhotos && Array.isArray(originalEvent.eventPhotos)) {
      this.photos = originalEvent.eventPhotos
        .filter((photo: any) => typeof photo === 'object' && photo.url)
        .sort((a: EventPhoto, b: EventPhoto) => {
          const dateA = a.uploadedAt instanceof Timestamp ? a.uploadedAt.toMillis() : 0;
          const dateB = b.uploadedAt instanceof Timestamp ? b.uploadedAt.toMillis() : 0;
          return dateB - dateA;
        });
    } else {
      this.photos = [];
    }
    
    this.isLoading = false;
    this.photoCountChanged.emit(this.photos.length);
  }

  async uploadPhoto() {
    if (!this.permissions?.canUploadPhoto || this.isReadOnly) {
      this.showToast('Vous ne pouvez pas uploader de photo actuellement', 'warning');
      return;
    }
    
    // ✅ AJOUT : Vérifier la limite de photos
    if (this.photos.length >= 50) {
      this.showToast('Limite atteinte : maximum 50 photos par événement', 'warning');
      return;
    }
    
    try {
      const actionSheet = await this.actionSheetController.create({
        header: 'Ajouter une photo',
        buttons: [
          {
            text: 'Prendre une photo',
            icon: 'camera-outline',
            handler: () => {
              this.selectAndUploadPhoto('camera');
            }
          },
          {
            text: 'Choisir depuis la galerie',
            icon: 'images-outline',
            handler: () => {
              this.selectAndUploadPhoto('gallery');
            }
          },
          {
            text: 'Annuler',
            icon: 'close-outline',
            role: 'cancel'
          }
        ]
      });

      await actionSheet.present();
    } catch (error) {
      console.error('❌ Erreur ouverture ActionSheet:', error);
      this.showToast('Erreur lors de l\'ouverture du sélecteur', 'danger');
    }
  }

  private async selectAndUploadPhoto(source: 'camera' | 'gallery') {
    try {
      this.isUploading = true;

      // ✅ AJOUT : Vérification préalable de la limite
      if (this.photos.length >= 50) {
        this.showToast('Limite atteinte : maximum 50 photos par événement', 'warning');
        this.isUploading = false;
        return;
      }

      const blob = await this.storageService.selectImage(source);
      
      if (!blob) {
        this.isUploading = false;
        return;
      }

      // Créer un File à partir du blob
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });

      // ✅ VALIDATION 1 : Type de fichier
      if (!this.storageService.isValidImage(file)) {
        this.showToast('Format non supporté. Utilisez JPG, PNG ou WEBP', 'danger');
        this.isUploading = false;
        return;
      }

      // ✅ VALIDATION 2 : Taille avant compression (max 20MB pour fichier original)
      if (!this.storageService.isValidSize(file, 20)) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        this.showToast(`Photo trop volumineuse (${sizeMB}MB). Maximum 20MB`, 'danger');
        this.isUploading = false;
        return;
      }

      // ✅ AJOUT : Message de compression
      this.showToast('Optimisation de la photo...', 'success');

      // ✅ OPTIMISATION : Compression et redimensionnement
      let optimizedFile: File;
      try {
        optimizedFile = await this.storageService.optimizeImage(file, 1920, 1920, 0.8);
        
        // Vérifier que la compression a fonctionné
        const originalSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const optimizedSizeMB = (optimizedFile.size / (1024 * 1024)).toFixed(1);
        console.log(`✅ Compression : ${originalSizeMB}MB → ${optimizedSizeMB}MB`);
        
      } catch (compressionError) {
        console.error('⚠️ Erreur compression, utilisation du fichier original:', compressionError);
        optimizedFile = file; // Utiliser l'original si la compression échoue
      }

      // ✅ VALIDATION 3 : Vérifier la taille après compression (max 5MB)
      if (!this.storageService.isValidSize(optimizedFile, 5)) {
        const sizeMB = (optimizedFile.size / (1024 * 1024)).toFixed(1);
        this.showToast(`Photo encore trop volumineuse après compression (${sizeMB}MB)`, 'danger');
        this.isUploading = false;
        return;
      }

      // Upload vers Firebase Storage
      this.showToast('Upload en cours...', 'success');
      
      const photoUrl = await this.storageService.uploadImageWithAutoNamePromise(
        optimizedFile,
        `events/${this.eventId}/photos`
      );

      // Créer l'objet EventPhoto
      const newPhoto: EventPhoto = {
        eventId: this.eventId,
        url: photoUrl,
        uploadedBy: this.currentUserId!,
        uploadedByName: await this.getUserName(),
        uploadedAt: Timestamp.now()
      };

      // Mettre à jour l'événement avec la nouvelle photo
      const originalEvent = this.event as any;
      const currentPhotos = originalEvent.eventPhotos || [];
      
      // ✅ VALIDATION 4 : Dernière vérification avant ajout
      if (currentPhotos.length >= 50) {
        // Au cas où une autre photo a été ajoutée pendant l'upload
        await this.storageService.deleteImagePromise(photoUrl); // Nettoyer
        this.showToast('Limite atteinte pendant l\'upload', 'warning');
        this.isUploading = false;
        return;
      }
      
      const updatedPhotos = [...currentPhotos, newPhoto];
      
      await this.eventsService.updateEvent(
        this.eventId, 
        { eventPhotos: updatedPhotos } as Partial<Event>,
        false // Pas de notification pour l'ajout de photo
      ).toPromise();

      // Recharger les photos
      this.loadPhotos();
      this.eventUpdated.emit();

      // ✅ Message de succès avec compte
      const photoCount = updatedPhotos.length;
      this.showToast(`Photo ajoutée (${photoCount}/50)`, 'success');
      this.isUploading = false;

    } catch (error: any) {
      console.error('❌ Erreur upload photo:', error);
      
      // ✅ Messages d'erreur plus détaillés
      let errorMessage = 'Erreur lors de l\'ajout de la photo';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Accès non autorisé au stockage';
      } else if (error.code === 'storage/quota-exceeded') {
        errorMessage = 'Quota de stockage dépassé';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Upload annulé';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      this.showToast(errorMessage, 'danger');
      this.isUploading = false;
    }
  }

  private async getUserName(): Promise<string> {
    const user = this.authService.getCurrentUser();
    return user?.displayName || user?.email || 'Utilisateur';
  }

  async openPhoto(photo: EventPhoto) {
    this.currentPhotoIndex = this.photos.indexOf(photo);
    this.showLightbox = true;
  }

  closeLightbox() {
    this.showLightbox = false;
  }

  previousPhoto() {
    if (this.currentPhotoIndex > 0) {
      this.currentPhotoIndex--;
    }
  }

  nextPhoto() {
    if (this.currentPhotoIndex < this.photos.length - 1) {
      this.currentPhotoIndex++;
    }
  }

  get currentPhoto(): EventPhoto | null {
    return this.photos[this.currentPhotoIndex] || null;
  }

  async showPhotoActions(photo: EventPhoto) {
    const canDelete = photo.uploadedBy === this.currentUserId;

    const actionSheet = await this.actionSheetController.create({
      header: `Photo de ${photo.uploadedByName}`,
      buttons: [
        {
          text: 'Télécharger',
          icon: 'download-outline',
          handler: () => {
            this.downloadPhoto(photo);
          }
        },
        ...(canDelete ? [{
          text: 'Supprimer',
          icon: 'trash-outline',
          role: 'destructive' as const,
          handler: () => {
            this.confirmDeletePhoto(photo);
          }
        }] : []),
        {
          text: 'Annuler',
          icon: 'close-outline',
          role: 'cancel' as const
        }
      ]
    });

    await actionSheet.present();
  }

  downloadPhoto(photo: EventPhoto) {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = `event_photo_${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showToast('Téléchargement lancé', 'success');
  }

  async confirmDeletePhoto(photo: EventPhoto) {
    const alert = await this.alertController.create({
      header: 'Supprimer la photo',
      message: 'Êtes-vous sûr de vouloir supprimer cette photo ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.deletePhoto(photo);
          }
        }
      ]
    });

    await alert.present();
  }

  private async deletePhoto(photo: EventPhoto) {
    try {
      await this.storageService.deleteImagePromise(photo.url);

      const originalEvent = this.event as any;
      const currentPhotos = originalEvent.eventPhotos || [];
      const updatedPhotos = currentPhotos.filter((p: EventPhoto) => p.url !== photo.url);
      
      await this.eventsService.updateEvent(
        this.eventId,
        { eventPhotos: updatedPhotos } as Partial<Event>,
        false
      ).toPromise();

      this.eventUpdated.emit();

      this.showToast('Photo supprimée', 'success');

    } catch (error) {
      console.error('❌ Erreur suppression photo:', error);
      this.showToast('Erreur lors de la suppression', 'danger');
    }
  }

  trackByUrl(index: number, photo: EventPhoto): string {
    return photo.url;
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}