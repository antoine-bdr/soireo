// src/app/core/services/storage.service.ts
// Service de gestion des uploads Firebase Storage - VERSION CORRIGÉE

import { Injectable, inject } from '@angular/core';
import {
  Storage,
  ref,
  uploadBytesResumable,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  UploadTask
} from '@angular/fire/storage';
import { camera } from 'ionicons/icons';
import { Observable, from, throwError, firstValueFrom } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly storage = inject(Storage);

  constructor() {}

  /**
   * Upload une image et retourne son URL (Observable)
   * @param file Fichier à uploader
   * @param path Chemin dans Storage (ex: 'events/event-123.jpg')
   * @returns Observable avec l'URL de téléchargement
   */
  uploadImage(file: File, path: string): Observable<string> {
    const storageRef = ref(this.storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

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
   * ✅ NOUVELLE MÉTHODE : Upload une image et retourne son URL (Promise)
   * Utilisé dans event-edit.page.ts avec async/await
   * @param file Fichier à uploader
   * @param path Chemin dans Storage
   * @returns Promise avec l'URL de téléchargement
   */
  async uploadImagePromise(file: File, path: string): Promise<string> {
    const storageRef = ref(this.storage, path);
    
    try {
      console.log('📤 Début upload:', path);
      
      // Upload le fichier
      const uploadResult = await uploadBytesResumable(storageRef, file);
      
      // Récupère l'URL de téléchargement
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      console.log('✅ Image uploadée:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('❌ Erreur upload:', error);
      throw error;
    }
  }

  /**
   * Upload une image avec un nom généré automatiquement (Observable)
   * @param file Fichier à uploader
   * @param folder Dossier dans Storage (ex: 'events', 'profiles')
   * @returns Observable avec l'URL de téléchargement
   */
  uploadImageWithAutoName(file: File, folder: string): Observable<string> {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const path = `${folder}/${fileName}`;
    
    return this.uploadImage(file, path);
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Upload avec nom auto (Promise)
   */
  async uploadImageWithAutoNamePromise(file: File, folder: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const path = `${folder}/${fileName}`;
    
    return this.uploadImagePromise(file, path);
  }

  /**
   * Supprime une image de Storage
   * @param imageUrl URL de l'image à supprimer
   * @returns Observable de la suppression
   */
  deleteImage(imageUrl: string): Observable<void> {
    try {
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
   * ✅ NOUVELLE MÉTHODE : Supprime une image (Promise)
   */
  async deleteImagePromise(imageUrl: string): Promise<void> {
    try {
      const imageRef = ref(this.storage, imageUrl);
      await deleteObject(imageRef);
      console.log('✅ Image supprimée:', imageUrl);
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      throw error;
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

    /**
   * 📸 Sélectionne une image depuis la galerie ou l'appareil photo
   * @param source 'camera' ou 'gallery'
   * @returns Promise<Blob | null>
   */
    async selectImage(source: 'camera' | 'gallery' = 'gallery'): Promise<Blob | null> {
      try {
        const image = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos
        });
  
        if (!image.webPath) {
          return null;
        }
  
        // Convertir en Blob
        const response = await fetch(image.webPath);
        const blob = await response.blob();
  
        return blob;
      } catch (error) {
        console.error('❌ Erreur sélection image:', error);
        return null;
      }
    }
  
    /**
     * ⬆️ Upload une image vers Firebase Storage
     * @param blob Image à uploader
     * @param userId ID de l'utilisateur
     * @param conversationId ID de la conversation
     * @returns Promise<string> URL de l'image uploadée
     */
    async uploadMessageImage(
      blob: Blob,
      userId: string,
      conversationId: string
    ): Promise<string> {
      try {
        // Générer un nom de fichier unique
        const fileName = `${uuidv4()}.jpg`;
        const filePath = `messages/${conversationId}/${fileName}`;
        
        // Créer la référence
        const storageRef = ref(this.storage, filePath);
  
        console.log('⬆️ Upload image vers:', filePath);
  
        // Upload
        const snapshot = await uploadBytes(storageRef, blob, {
          contentType: 'image/jpeg'
        });
  
        // Récupérer l'URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log('✅ Image uploadée:', downloadURL);
        return downloadURL;
      } catch (error) {
        console.error('❌ Erreur upload image:', error);
        throw error;
      }
    }
  
    /**
     * 🗑️ Supprime une image de Firebase Storage
     * @param imageUrl URL de l'image à supprimer
     */
    async deleteMessageImage(imageUrl: string): Promise<void> {
      try {
        const storageRef = ref(this.storage, imageUrl);
        await deleteObject(storageRef);
        console.log('✅ Image supprimée');
      } catch (error) {
        console.error('❌ Erreur suppression image:', error);
        throw error;
      }
    }
  
    /**
     * 🖼️ Crée une URL locale temporaire pour preview
     * @param blob Image en Blob
     * @returns string URL temporaire
     */
    createLocalImageUrl(blob: Blob): string {
      return URL.createObjectURL(blob);
    }
  
    /**
     * 🧹 Libère une URL temporaire
     * @param url URL à libérer
     */
    revokeLocalImageUrl(url: string): void {
      URL.revokeObjectURL(url);
    }

    // src/app/core/services/storage.service.ts
    // ✅ AJOUT : Méthode de compression optimisée

    // Ajouter cette méthode dans la classe StorageService existante

    /**
     * ✅ NOUVELLE MÉTHODE : Compresse une image avec qualité ajustable
     * @param file Fichier image
     * @param quality Qualité de compression (0.1 à 1.0, défaut 0.8)
     * @returns Promise avec le fichier compressé
     */
    async compressImage(file: File, quality: number = 0.8): Promise<File> {
      return new Promise((resolve, reject) => {
        // Valider la qualité
        if (quality < 0.1 || quality > 1.0) {
          quality = 0.8;
        }

        const reader = new FileReader();
        
        reader.onload = (e: any) => {
          const img = new Image();
          
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Impossible de créer le contexte canvas'));
              return;
            }

            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                
                console.log(`✅ Compression : ${(file.size / 1024).toFixed(2)}KB → ${(compressedFile.size / 1024).toFixed(2)}KB`);
                resolve(compressedFile);
              } else {
                reject(new Error('Erreur de compression'));
              }
            }, 'image/jpeg', quality);
          };

          img.onerror = () => reject(new Error('Erreur de lecture image'));
          img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
        reader.readAsDataURL(file);
      });
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Redimensionne ET compresse en une seule étape
     * @param file Fichier image
     * @param maxWidth Largeur maximale
     * @param maxHeight Hauteur maximale
     * @param quality Qualité de compression
     * @returns Promise avec le fichier optimisé
     */
    async optimizeImage(
      file: File, 
      maxWidth: number = 1920, 
      maxHeight: number = 1920,
      quality: number = 0.8
    ): Promise<File> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e: any) => {
          const img = new Image();
          
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calcule les nouvelles dimensions
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
            if (!ctx) {
              reject(new Error('Impossible de créer le contexte canvas'));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob) {
                const optimizedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                
                const originalSize = (file.size / 1024).toFixed(2);
                const optimizedSize = (optimizedFile.size / 1024).toFixed(2);
                const reduction = ((1 - optimizedFile.size / file.size) * 100).toFixed(1);
                
                console.log(`✅ Optimisation : ${originalSize}KB → ${optimizedSize}KB (-${reduction}%)`);
                resolve(optimizedFile);
              } else {
                reject(new Error('Erreur d\'optimisation'));
              }
            }, 'image/jpeg', quality);
          };

          img.onerror = () => reject(new Error('Erreur de lecture image'));
          img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
        reader.readAsDataURL(file);
      });
    }
}