import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  ModalController,
  ActionSheetController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline, imagesOutline, chevronBackOutline, chevronForwardOutline, personOutline, ellipsisVerticalOutline, downloadOutline } from 'ionicons/icons';
// ✅ AJOUTER CET IMPORT
import { EventPhoto } from '../../../core/models/event.model';

// Ajouter dans les imports (après les imports existants)
import { getBlob, ref, Storage } from '@angular/fire/storage';  // ✅ AJOUTER
import { Filesystem, Directory } from '@capacitor/filesystem';  // ✅ AJOUTER
import { Share } from '@capacitor/share';
import { Platform } from '@ionic/angular/standalone';  // ✅ AJOUTER

/**
 * 🖼️ MODAL GALERIE PHOTOS
 * Affiche toutes les photos d'un événement en plein écran
 */
@Component({
  selector: 'app-photo-gallery-modal',
  templateUrl: './photo-gallery-modal.component.html',
  styleUrls: ['./photo-gallery-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonGrid,
    IonRow,
    IonCol
  ]
})
export class PhotoGalleryModalComponent {
  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly storage = inject(Storage);  // ✅ AJOUTER (depuis @angular/fire/storage)
  private readonly platform = inject(Platform);  // ✅ AJOUTER

  // ✅ MODIFIER LE TYPE
  @Input() photos: EventPhoto[] = [];
  @Input() eventTitle: string = '';
  @Input() currentUserId: string = '';  // ✅ AJOUTER
  @Input() isOrganizer: boolean = false;  // ✅ AJOUTER

  selectedPhotoIndex: number | null = null;


  constructor() {
    addIcons({closeOutline, personOutline, trashOutline, imagesOutline, chevronBackOutline, chevronForwardOutline, ellipsisVerticalOutline, downloadOutline});
  }

  // ✅ AJOUTER CETTE MÉTHODE
  /**
   * Vérifie si l'utilisateur peut supprimer une photo
   */
  canDeletePhoto(photo: EventPhoto): boolean {
    return this.isOrganizer || photo.uploadedBy === this.currentUserId;
  }

  /**
   * Ferme la modal
   */
  dismiss() {
    this.modalCtrl.dismiss();
  }

  /**
   * Ouvre une photo en plein écran
   */
  openPhoto(index: number) {
    this.selectedPhotoIndex = index;
  }

  /**
   * Ferme la vue plein écran
   */
  closeFullScreen() {
    this.selectedPhotoIndex = null;
  }

  /**
   * Photo suivante
   */
  nextPhoto() {
    if (this.selectedPhotoIndex !== null && this.selectedPhotoIndex < this.photos.length - 1) {
      this.selectedPhotoIndex++;
    }
  }

  /**
   * Photo précédente
   */
  previousPhoto() {
    if (this.selectedPhotoIndex !== null && this.selectedPhotoIndex > 0) {
      this.selectedPhotoIndex--;
    }
  }

  /**
   * Supprime une photo (émet un événement vers le parent)
   */
  deletePhoto(index: number) {
    this.modalCtrl.dismiss({ action: 'delete', photoIndex: index });
  }

  // Ajouter après la méthode deletePhoto() (ligne ~105)

/**
 * ✅ Ouvre le menu d'options pour une photo
 */
  async openPhotoOptions(photo: EventPhoto, index: number) {
    const buttons: any[] = [
      {
        text: 'Télécharger',
        icon: 'download-outline',
        handler: () => {
          this.downloadPhoto(photo.url, index);
        }
      }
    ];

    // ✅ Ajouter l'option "Supprimer" uniquement si autorisé
    if (this.canDeletePhoto(photo)) {
      buttons.push({
        text: 'Supprimer',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => {
          this.deletePhoto(index);
        }
      });
    }

    buttons.push({
      text: 'Annuler',
      role: 'cancel'
    });

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Options de la photo',
      buttons: buttons
    });

    await actionSheet.present();
  }

/**
 * ✅ Télécharge une photo dans la galerie de l'appareil
 */
  // Remplacer complètement downloadPhoto() par cette version simple

/**
 * ✅ Télécharge/Partage une photo
 * Mobile : Share API
 * Web : Ouvre dans nouvel onglet
 */
  async downloadPhoto(photoUrl: string, index: number) {
    try {
      console.log('📥 Téléchargement:', photoUrl);

      // ✅ Mobile natif : Share API
      if (this.platform.is('capacitor') && !this.platform.is('mobileweb')) {
        if (await Share.canShare()) {
          await Share.share({
            title: `Photo ${index + 1}`,
            text: 'Photo de l\'événement',
            url: photoUrl,
            dialogTitle: 'Sauvegarder ou partager'
          });
        }
      } 
      // ✅ Web : Ouvrir dans nouvel onglet
      else {
        window.open(photoUrl, '_blank');
      }

    } catch (error) {
      console.error('❌ Erreur:', error);
    }
  }

  /**
   * ✅ Téléchargement web (via blob URL)
   */
  private async downloadPhotoWeb(blob: Blob, index: number) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `soireo-photo-${index + 1}-${Date.now()}.jpg`;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * ✅ Téléchargement mobile natif (via Capacitor Filesystem)
   */
  private async downloadPhotoNative(blob: Blob, index: number) {
    try {
      // ✅ Convertir blob en base64
      const base64Data = await this.blobToBase64(blob);
      
      // ✅ Nom du fichier
      const fileName = `soireo-photo-${index + 1}-${Date.now()}.jpg`;
      
      // ✅ Sauvegarder dans le répertoire Documents (accessible via galerie)
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents
      });

      console.log('✅ Photo sauvegardée:', result.uri);
      
      // ✅ Option : proposer de partager la photo
      if (await Share.canShare()) {
        await Share.share({
          title: 'Photo téléchargée',
          text: 'Photo sauvegardée avec succès !',
          url: result.uri,
          dialogTitle: 'Partager la photo'
        });
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde native:', error);
      throw error;
    }
  }

  /**
   * ✅ Convertit un Blob en base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Retirer le prefix "data:image/jpeg;base64,"
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * ✅ Extrait le path Storage depuis une URL Firebase
   * Exemple: https://firebasestorage.../o/events%2Fabc%2Fphotos%2Fphoto.jpg?alt=media
   * Retourne: events/abc/photos/photo.jpg
   */
  private extractStoragePath(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
      
      if (pathMatch && pathMatch[1]) {
        // Décoder les caractères encodés (%2F -> /)
        return decodeURIComponent(pathMatch[1]);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur parsing URL:', error);
      return null;
    }
  }

  /**
   * Gère le swipe pour naviguer entre les photos
   */
  handleSwipe(event: any) {
    if (this.selectedPhotoIndex === null) return;

    if (event.direction === 2) { // Swipe left
      this.nextPhoto();
    } else if (event.direction === 4) { // Swipe right
      this.previousPhoto();
    }
  }
}