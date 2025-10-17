// src/app/core/services/storage.service.ts
// Service de gestion des uploads Firebase Storage

import { Injectable, inject } from '@angular/core';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTask
} from '@angular/fire/storage';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly storage = inject(Storage);

  constructor() {}

  /**
   * Upload une image et retourne son URL
   * @param file Fichier à uploader
   * @param path Chemin dans Storage (ex: 'events/event-123.jpg')
   * @returns Observable avec l'URL de téléchargement
   */
  uploadImage(file: File, path: string): Observable<string> {
    // Crée une référence vers le fichier dans Storage
    const storageRef = ref(this.storage, path);
    
    // Upload le fichier
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Retourne un Observable qui émet l'URL quand l'upload est terminé
    return new Observable(observer => {
      uploadTask.on('state_changed',
        // Progress
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`📤 Upload en cours: ${progress.toFixed(0)}%`);
        },
        // Error
        (error) => {
          console.error('❌ Erreur upload:', error);
          observer.error(error);
        },
        // Complete
        async () => {
          try {
            // Récupère l'URL de téléchargement
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('✅ Image uploadée:', downloadURL);
            observer.next(downloadURL);
            observer.complete();
          } catch (error) {
            observer.error(error);
          }
        }
      );
    });
  }

  /**
   * Upload une image avec un nom généré automatiquement
   * @param file Fichier à uploader
   * @param folder Dossier dans Storage (ex: 'events', 'profiles')
   * @returns Observable avec l'URL de téléchargement
   */
  uploadImageWithAutoName(file: File, folder: string): Observable<string> {
    // Génère un nom unique basé sur le timestamp
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const path = `${folder}/${fileName}`;
    
    return this.uploadImage(file, path);
  }

  /**
   * Supprime une image de Storage
   * @param imageUrl URL de l'image à supprimer
   * @returns Observable de la suppression
   */
  deleteImage(imageUrl: string): Observable<void> {
    try {
      // Crée une référence depuis l'URL
      const imageRef = ref(this.storage, imageUrl);
      
      return from(deleteObject(imageRef)).pipe(
        catchError(error => {
          console.error('❌ Erreur suppression image:', error);
          return throwError(() => error);
        })
      );
    } catch (error) {
      console.error('❌ URL invalide:', imageUrl);
      return throwError(() => error);
    }
  }

  /**
   * Valide qu'un fichier est une image
   * @param file Fichier à valider
   * @returns true si c'est une image valide
   */
  isValidImage(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
  }

  /**
   * Valide la taille d'un fichier
   * @param file Fichier à valider
   * @param maxSizeMB Taille maximale en MB (défaut: 5MB)
   * @returns true si la taille est valide
   */
  isValidSize(file: File, maxSizeMB: number = 5): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }

  /**
   * Redimensionne une image avant upload (optionnel, pour optimisation)
   * @param file Fichier image
   * @param maxWidth Largeur maximale
   * @param maxHeight Hauteur maximale
   * @returns Promise avec le fichier redimensionné
   */
  async resizeImage(file: File, maxWidth: number = 1200, maxHeight: number = 1200): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: any) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calcule les nouvelles dimensions en gardant le ratio
          if (width > height) {
            if (width > maxWidth) {
              height = height * (maxWidth / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = width * (maxHeight / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(resizedFile);
            } else {
              reject(new Error('Erreur de redimensionnement'));
            }
          }, file.type);
        };

        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsDataURL(file);
    });
  }
}