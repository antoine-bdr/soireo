// src/app/features/events/event-detail/components/photos-segment/photos-segment.component.ts
// ✅ CORRECTION : Utilisation de optimizeImage du service

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
  closeOutline, expandOutline, chevronBackOutline, chevronForwardOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';

import { EventWithConditionalLocation, EventPhoto, Event } from '../../../../../core/models/event.model';
import { EventsService } from '../../../../../core/services/events.service';
import { StorageService } from '../../../../../core/services/storage.service';
import { AuthenticationService } from '../../../../../core/services/authentication.service';

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
    addIcons({
      cameraOutline, imagesOutline, addOutline, trashOutline, downloadOutline,
      closeOutline, expandOutline, chevronBackOutline, chevronForwardOutline
    });
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

      const blob = await this.storageService.selectImage(source);
      
      if (!blob) {
        this.isUploading = false;
        return;
      }

      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });

      if (!this.storageService.isValidImage(file)) {
        this.showToast('Format d\'image non valide', 'danger');
        this.isUploading = false;
        return;
      }

      if (!this.storageService.isValidSize(file, 10)) {
        this.showToast('L\'image est trop volumineuse (max 10MB)', 'danger');
        this.isUploading = false;
        return;
      }

      // ✅ CORRECTION : Utiliser optimizeImage du service
      // Redimensionne à 1920x1920 max + compression qualité 0.8
      const optimizedFile = await this.storageService.optimizeImage(file, 1920, 1920, 0.8);

      const photoUrl = await this.storageService.uploadImageWithAutoNamePromise(
        optimizedFile,
        `events/${this.eventId}/photos`
      );

      const newPhoto: EventPhoto = {
        eventId: this.eventId,
        url: photoUrl,
        uploadedBy: this.currentUserId!,
        uploadedByName: await this.getUserName(),
        uploadedAt: Timestamp.now()
      };

      const originalEvent = this.event as any;
      const currentPhotos = originalEvent.eventPhotos || [];
      const updatedPhotos = [...currentPhotos, newPhoto];
      
      await this.eventsService.updateEvent(
        this.eventId, 
        { eventPhotos: updatedPhotos } as Partial<Event>,
        false
      ).toPromise();

      this.eventUpdated.emit();

      this.showToast('Photo ajoutée avec succès', 'success');
      this.isUploading = false;

    } catch (error) {
      console.error('❌ Erreur upload photo:', error);
      this.showToast('Erreur lors de l\'ajout de la photo', 'danger');
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