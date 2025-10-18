// src/app/features/profile/profile.page.ts
// Page de profil utilisateur
// 🎯 Sprint 4 - Profil Utilisateur

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonAvatar,
  IonLabel,
  IonItem,
  IonInput,
  IonTextarea,
  IonButton,
  IonIcon,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  LoadingController,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personOutline, 
  mailOutline, 
  callOutline, 
  locationOutline, 
  cameraOutline,
  calendarOutline,
  logOutOutline,
  saveOutline,
  createOutline,
  checkmarkCircle
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { UsersService } from '../../core/services/users.service';
import { AuthenticationService } from '../../core/services/authentication.service';
import { User, UpdateUserDto } from '../../core/models/user.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonAvatar,
    IonLabel,
    IonItem,
    IonInput,
    IonTextarea,
    IonButton,
    IonIcon,
    IonBadge,
    IonGrid,
    IonRow,
    IonCol,
    IonSpinner,
    IonRefresher,
    IonRefresherContent
  ]
})
export class ProfilePage implements OnInit, OnDestroy {
  // ========================================
  // INJECTION DES SERVICES
  // ========================================
  private readonly usersService = inject(UsersService);
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  // ========================================
  // PROPRIÉTÉS
  // ========================================
  user: User | null = null;
  userId: string | null = null;
  isLoading = true;
  isEditing = false;
  isSaving = false;
  isUploadingPhoto = false;

  profileForm!: FormGroup;
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor() {
    // Enregistrement des icônes Ionic
    addIcons({
      personOutline,
      mailOutline,
      callOutline,
      locationOutline,
      cameraOutline,
      calendarOutline,
      logOutOutline,
      saveOutline,
      createOutline,
      checkmarkCircle
    });

    // Initialisation du formulaire
    this.initForm();
  }

  // ========================================
  // CYCLE DE VIE
  // ========================================

  ngOnInit() {
    this.userId = this.authService.getCurrentUserId();
    
    if (!this.userId) {
      console.error('❌ Aucun utilisateur connecté');
      this.router.navigate(['/login']);
      return;
    }

    this.loadUserProfile();
  }

  ngOnDestroy() {
    this.cleanupSubscriptions();
  }

  // ========================================
  // INITIALISATION
  // ========================================

  /**
   * Initialise le formulaire d'édition
   */
  private initForm() {
    this.profileForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      bio: ['', [Validators.maxLength(500)]],
      phoneNumber: [''],
      city: [''],
      country: ['']
    });
  }

  /**
   * Charge le profil utilisateur depuis Firestore
   */
  private loadUserProfile() {
    if (!this.userId) return;

    this.isLoading = true;

    const sub = this.usersService.getUserProfile(this.userId).subscribe({
      next: (user) => {
        if (user) {
          this.user = user;
          this.patchFormValues(user);
          console.log('✅ Profil utilisateur chargé:', user.displayName);
        } else {
          console.warn('⚠️ Profil utilisateur introuvable');
          this.showToast('Profil introuvable', 'danger');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erreur chargement profil:', error);
        this.showToast('Erreur de chargement', 'danger');
        this.isLoading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Remplit le formulaire avec les données utilisateur
   */
  private patchFormValues(user: User) {
    this.profileForm.patchValue({
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio || '',
      phoneNumber: user.phoneNumber || '',
      city: user.city || '',
      country: user.country || ''
    });
  }

  // ========================================
  // ACTIONS ÉDITION
  // ========================================

  /**
   * Active le mode édition
   */
  enableEditing() {
    this.isEditing = true;
  }

  /**
   * Annule l'édition et restaure les valeurs initiales
   */
  cancelEditing() {
    this.isEditing = false;
    if (this.user) {
      this.patchFormValues(this.user);
    }
    this.selectedFile = null;
    this.previewUrl = null;
  }

  /**
   * Sauvegarde les modifications du profil
   */
  async saveProfile() {
    if (this.profileForm.invalid || !this.userId) {
      this.showToast('Formulaire invalide', 'warning');
      return;
    }

    this.isSaving = true;

    const loading = await this.loadingCtrl.create({
      message: 'Enregistrement...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Étape 1 : Upload photo si nécessaire
      let photoURL = this.user?.photoURL;
      if (this.selectedFile) {
        photoURL = await this.uploadPhoto();
      }

      // Étape 2 : Prépare les données à mettre à jour
      const updates: UpdateUserDto = {
        displayName: this.profileForm.value.displayName,
        firstName: this.profileForm.value.firstName,
        lastName: this.profileForm.value.lastName,
        bio: this.profileForm.value.bio,
        phoneNumber: this.profileForm.value.phoneNumber,
        city: this.profileForm.value.city,
        country: this.profileForm.value.country
      };

      // Ajoute la photo si uploadée
      if (photoURL && photoURL !== this.user?.photoURL) {
        updates.photoURL = photoURL;
      }

      // Étape 3 : Met à jour le profil Firestore
      await new Promise<void>((resolve, reject) => {
        this.usersService.updateUserProfile(this.userId!, updates).subscribe({
          next: () => {
            console.log('✅ Profil mis à jour');
            resolve();
          },
          error: (error) => {
            console.error('❌ Erreur mise à jour profil:', error);
            reject(error);
          }
        });
      });

      // Étape 4 : Met à jour Firebase Auth (displayName + photo)
      await new Promise<void>((resolve, reject) => {
        this.authService.updateUserProfile(updates.displayName, photoURL).subscribe({
          next: () => {
            console.log('✅ Firebase Auth synchronisé');
            resolve();
          },
          error: (error) => {
            console.warn('⚠️ Erreur sync Firebase Auth:', error);
            resolve(); // Continue même si erreur (non bloquant)
          }
        });
      });

      await loading.dismiss();
      this.isSaving = false;
      this.isEditing = false;
      this.selectedFile = null;
      this.previewUrl = null;

      this.showToast('Profil mis à jour avec succès', 'success');
    } catch (error) {
      console.error('❌ Erreur sauvegarde profil:', error);
      await loading.dismiss();
      this.isSaving = false;
      this.showToast('Erreur lors de la sauvegarde', 'danger');
    }
  }

  // ========================================
  // GESTION PHOTO DE PROFIL
  // ========================================

  /**
   * Déclenche la sélection de fichier
   */
  triggerFileInput() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }

  /**
   * Gère la sélection d'une photo
   */
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Vérifie le type de fichier
    if (!file.type.startsWith('image/')) {
      this.showToast('Veuillez sélectionner une image', 'warning');
      return;
    }

    // Vérifie la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.showToast('Image trop volumineuse (max 5MB)', 'warning');
      return;
    }

    this.selectedFile = file;

    // Génère une prévisualisation
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    console.log('✅ Photo sélectionnée:', file.name);
  }

  /**
   * Upload la photo vers Firebase Storage
   */
  private async uploadPhoto(): Promise<string> {
    if (!this.selectedFile || !this.userId) {
      throw new Error('Aucune photo sélectionnée');
    }

    this.isUploadingPhoto = true;

    try {
      const photoURL = await this.usersService.uploadProfilePhoto(
        this.selectedFile,
        this.userId
      );
      
      console.log('✅ Photo uploadée:', photoURL);
      this.isUploadingPhoto = false;
      return photoURL;
    } catch (error) {
      this.isUploadingPhoto = false;
      throw error;
    }
  }

  // ========================================
  // DÉCONNEXION
  // ========================================

  /**
   * Déconnecte l'utilisateur
   */
  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Déconnexion',
          role: 'destructive',
          handler: () => {
            this.authService.logout().subscribe({
              next: () => {
                console.log('👋 Déconnexion réussie');
                this.router.navigate(['/login']);
              },
              error: (error) => {
                console.error('❌ Erreur déconnexion:', error);
                this.showToast('Erreur de déconnexion', 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  /**
   * Pull-to-refresh
   */
  handleRefresh(event: any) {
    this.loadUserProfile();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  /**
   * Calcule la durée depuis la création du compte
   */
  getMemberSince(): string {
    if (!this.user?.createdAt) return '';

    const createdDate = this.user.createdAt.toDate();
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} mois`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} an${years > 1 ? 's' : ''}`;
    }
  }

  /**
   * Affiche un toast
   */
  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
      buttons: [{ icon: 'close', role: 'cancel' }]
    });
    await toast.present();
  }

  /**
   * Nettoie les subscriptions
   */
  private cleanupSubscriptions() {
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) sub.unsubscribe();
    });
    this.subscriptions = [];
  }
}