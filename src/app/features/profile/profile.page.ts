// src/app/features/profile/profile.page.ts
// Page de profil utilisateur ENRICHIE
// 🎯 Sprint 4 - Profil Utilisateur ENRICHI

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
  IonCard,
  IonCardContent,
  IonAvatar,
  IonItem,
  IonInput,
  IonTextarea,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonChip,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonModal,
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
  checkmarkCircle, 
  shieldCheckmarkOutline, 
  alertCircle, 
  refreshOutline,
  star,
  trophy,
  sparkles,
  medal,
  people,
  closeCircle,
  addCircle,
  imagesOutline,
  closeOutline,
  heartOutline,
  musicalNote,
  personAddOutline  // ✅ NOUVEAU : Pour le bouton d'ajout d'amis
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { UsersService } from '../../core/services/users.service';
import { AuthenticationService } from '../../core/services/authentication.service';
import { 
  User, 
  UpdateUserDto, 
  UserBadge, 
  ProfileCompletionStatus,
  SUGGESTED_INTERESTS,
  MUSIC_STYLES,
  calculateAge
} from '../../core/models/user.model';

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
    IonCard,
    IonCardContent,
    IonAvatar,
    IonItem,
    IonInput,
    IonTextarea,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonBadge,
    IonChip,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonModal
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
  // PROPRIÉTÉS DE BASE
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

  isEmailVerified = false;
  userEmail: string | null = null;
  isLoadingVerification = false;

  private subscriptions: Subscription[] = [];

  // ========================================
  // NOUVELLES PROPRIÉTÉS (ENRICHISSEMENT)
  // ========================================
  
  // Badges
  userBadges: UserBadge[] = [];
  
  // Progression du profil
  profileCompletion: ProfileCompletionStatus = {
    percentage: 0,
    completedFields: [],
    missingFields: [],
    totalFields: 8,
    completedCount: 0
  };

  // Âge calculé
  userAge: number | null = null;

  // Centres d'intérêt
  suggestedInterests = SUGGESTED_INTERESTS;
  selectedInterests: string[] = [];
  showInterestsPicker = false;

  // Styles de musique
  musicStyles = MUSIC_STYLES;
  selectedMusicStyles: string[] = [];
  showMusicStylesPicker = false;

  // Galerie photos
  galleryPhotos: string[] = [];
  selectedGalleryFiles: File[] = [];
  galleryPreviews: string[] = [];
  maxPhotos = 6;  // 6 photos maximum

  constructor() {
    // Enregistrement des icônes
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
      checkmarkCircle,
      shieldCheckmarkOutline,
      alertCircle,
      refreshOutline,
      star,
      trophy,
      sparkles,
      medal,
      people,
      closeCircle,
      addCircle,
      imagesOutline,
      closeOutline,
      heartOutline,
      musicalNote,
      personAddOutline  // ✅ NOUVEAU
    });
  }

  ngOnInit() {
    this.initializeForm();
    this.loadUserProfile();
  }

  ngOnDestroy() {
    // Nettoie toutes les subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ========================================
  // INITIALISATION
  // ========================================

  /**
   * Initialise le formulaire avec validation enrichie
   */
  private initializeForm() {
    this.profileForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      bio: ['', [Validators.maxLength(500)]],
      phoneNumber: [''],
      dateOfBirth: [''],  // NOUVEAU
      gender: [''],        // NOUVEAU
      city: [''],
      country: ['']
    });
  }

  /**
   * Charge le profil utilisateur et calcule les données enrichies
   */
  private loadUserProfile() {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      console.error('❌ Aucun utilisateur connecté');
      this.router.navigate(['/login']);
      return;
    }

    this.userId = currentUser.uid;
    this.userEmail = currentUser.email;
    this.isEmailVerified = currentUser.emailVerified;

    // Vérification de sécurité
    if (!this.userId) {
      console.error('❌ userId est null');
      this.router.navigate(['/login']);
      return;
    }

    // Écoute les changements du profil en temps réel
    const sub = this.usersService.getUserProfile(this.userId).subscribe({
      next: (user) => {
        if (user) {
          this.user = user;
          this.patchFormValues(user);
          
          // NOUVEAU : Calcul des données enrichies
          this.calculateEnrichedData(user);
          
          console.log('✅ Profil utilisateur chargé');
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
   * NOUVEAU : Calcule les données enrichies (badges, progression, âge)
   */
  private calculateEnrichedData(user: User) {
    // Calcul des badges
    this.userBadges = this.usersService.getUserBadges(user);

    // Calcul de la progression
    this.profileCompletion = this.usersService.calculateProfileCompletion(user);

    // Calcul de l'âge
    if (user.dateOfBirth) {
      this.userAge = calculateAge(user.dateOfBirth);
    }

    // Chargement des centres d'intérêt
    this.selectedInterests = user.interests || [];

    // Chargement des styles de musique
    this.selectedMusicStyles = user.musicStyles || [];

    // Chargement de la galerie
    this.galleryPhotos = user.profilePhotos || [];
  }

  /**
   * Remplit le formulaire avec les données utilisateur
   */
  private patchFormValues(user: User) {
    // 🐛 FIX : Convertir la date de naissance en format YYYY-MM-DD pour l'input date
    let dateOfBirthValue = '';
    if (user.dateOfBirth) {
      const date = user.dateOfBirth.toDate();
      // Format ISO : YYYY-MM-DD
      dateOfBirthValue = date.toISOString().split('T')[0];
    }

    this.profileForm.patchValue({
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio || '',
      phoneNumber: user.phoneNumber || '',
      dateOfBirth: dateOfBirthValue,  // Date au format YYYY-MM-DD
      gender: user.gender || '',
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
      this.selectedInterests = this.user.interests || [];
      this.selectedMusicStyles = this.user.musicStyles || [];
    }
    this.selectedFile = null;
    this.previewUrl = null;
    this.selectedGalleryFiles = [];
    this.galleryPreviews = [];
  }

  /**
   * Sauvegarde les modifications du profil (ENRICHI)
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
      // Étape 1 : Upload photo principale si nécessaire
      let photoURL = this.user?.photoURL;
      if (this.selectedFile) {
        photoURL = await this.usersService.uploadProfilePhoto(this.selectedFile, this.userId);
      }

      // Étape 2 : Upload galerie photos si nécessaire
      let galleryUrls = this.user?.profilePhotos || [];
      if (this.selectedGalleryFiles.length > 0) {
        const newUrls = await this.usersService.uploadMultiplePhotos(
          this.selectedGalleryFiles, 
          this.userId
        );
        galleryUrls = [...galleryUrls, ...newUrls];
      }

      // Étape 3 : Prépare les données à mettre à jour (ENRICHI)
      const formValue = this.profileForm.value;
      const updates: UpdateUserDto = {
        displayName: formValue.displayName,
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        bio: formValue.bio,
        phoneNumber: formValue.phoneNumber,
        dateOfBirth: formValue.dateOfBirth ? new Date(formValue.dateOfBirth) : undefined,
        gender: formValue.gender || undefined,
        city: formValue.city,
        country: formValue.country,
        interests: this.selectedInterests,        // NOUVEAU
        musicStyles: this.selectedMusicStyles,    // NOUVEAU
        profilePhotos: galleryUrls                // NOUVEAU
      };

      if (photoURL) {
        updates.photoURL = photoURL;
      }

      // Étape 4 : Met à jour le profil
      this.usersService.updateUserProfile(this.userId, updates).subscribe({
        next: async () => {
          await loading.dismiss();
          this.showToast('Profil mis à jour avec succès', 'success');
          this.isEditing = false;
          this.selectedFile = null;
          this.previewUrl = null;
          this.selectedGalleryFiles = [];
          this.galleryPreviews = [];
          this.isSaving = false;
        },
        error: async (error) => {
          await loading.dismiss();
          console.error('❌ Erreur mise à jour profil:', error);
          this.showToast('Erreur lors de la mise à jour', 'danger');
          this.isSaving = false;
        }
      });

    } catch (error) {
      await loading.dismiss();
      console.error('❌ Erreur:', error);
      this.showToast('Erreur lors de l\'upload', 'danger');
      this.isSaving = false;
    }
  }

  // ========================================
  // GESTION PHOTO PRINCIPALE
  // ========================================

  /**
   * Déclenche le sélecteur de fichier
   */
  triggerFileInput() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }

  /**
   * Gère la sélection d'un fichier photo
   */
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Vérifie que c'est une image
      if (!file.type.startsWith('image/')) {
        this.showToast('Veuillez sélectionner une image', 'warning');
        return;
      }

      // Limite la taille à 5MB
      if (file.size > 5 * 1024 * 1024) {
        this.showToast('Image trop volumineuse (max 5MB)', 'warning');
        return;
      }

      this.selectedFile = file;

      // Crée une prévisualisation
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  // ========================================
  // GESTION GALERIE PHOTOS (NOUVEAU)
  // ========================================

  /**
   * NOUVEAU : Déclenche le sélecteur de fichiers pour la galerie
   */
  triggerGalleryInput() {
    const fileInput = document.getElementById('galleryInput') as HTMLInputElement;
    fileInput?.click();
  }

  /**
   * NOUVEAU : Gère la sélection de photos pour la galerie
   */
  onGalleryFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      
      // Vérifie le nombre total de photos
      const totalPhotos = this.galleryPhotos.length + this.selectedGalleryFiles.length + files.length;
      if (totalPhotos > this.maxPhotos) {
        this.showToast(`Maximum ${this.maxPhotos} photos autorisées`, 'warning');
        return;
      }

      // Vérifie que ce sont des images
      const validFiles = files.filter(file => file.type.startsWith('image/'));
      if (validFiles.length !== files.length) {
        this.showToast('Certains fichiers ne sont pas des images', 'warning');
      }

      // Vérifie la taille
      const oversizedFiles = validFiles.filter(file => file.size > 5 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        this.showToast('Certaines images sont trop volumineuses (max 5MB)', 'warning');
        return;
      }

      // Ajoute les fichiers et crée les prévisualisations
      validFiles.forEach(file => {
        this.selectedGalleryFiles.push(file);

        const reader = new FileReader();
        reader.onload = () => {
          this.galleryPreviews.push(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /**
   * NOUVEAU : Supprime une photo de la galerie (prévisualisation)
   */
  removeGalleryPreview(index: number) {
    this.galleryPreviews.splice(index, 1);
    this.selectedGalleryFiles.splice(index, 1);
  }

  /**
   * NOUVEAU : Supprime une photo existante de la galerie
   */
  async removeGalleryPhoto(index: number) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer la photo',
      message: 'Êtes-vous sûr de vouloir supprimer cette photo ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            if (this.user && this.userId) {
              const updatedPhotos = [...this.galleryPhotos];
              updatedPhotos.splice(index, 1);
              
              this.usersService.updateUserProfile(this.userId, {
                profilePhotos: updatedPhotos
              }).subscribe({
                next: () => {
                  this.showToast('Photo supprimée', 'success');
                },
                error: (error) => {
                  console.error('❌ Erreur suppression:', error);
                  this.showToast('Erreur lors de la suppression', 'danger');
                }
              });
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // ========================================
  // GESTION CENTRES D'INTÉRÊT (NOUVEAU)
  // ========================================

  /**
   * NOUVEAU : Toggle un centre d'intérêt
   */
  toggleInterest(interest: string) {
    const index = this.selectedInterests.indexOf(interest);
    if (index > -1) {
      this.selectedInterests.splice(index, 1);
    } else {
      if (this.selectedInterests.length >= 10) {
        this.showToast('Maximum 10 centres d\'intérêt', 'warning');
        return;
      }
      this.selectedInterests.push(interest);
    }
  }

  /**
   * NOUVEAU : Vérifie si un intérêt est sélectionné
   */
  isInterestSelected(interest: string): boolean {
    return this.selectedInterests.includes(interest);
  }

  // ========================================
  // GESTION STYLES DE MUSIQUE (NOUVEAU)
  // ========================================

  /**
   * NOUVEAU : Toggle un style de musique
   */
  toggleMusicStyle(style: string) {
    const index = this.selectedMusicStyles.indexOf(style);
    if (index > -1) {
      this.selectedMusicStyles.splice(index, 1);
    } else {
      if (this.selectedMusicStyles.length >= 5) {
        this.showToast('Maximum 5 styles de musique', 'warning');
        return;
      }
      this.selectedMusicStyles.push(style);
    }
  }

  /**
   * NOUVEAU : Vérifie si un style de musique est sélectionné
   */
  isMusicStyleSelected(style: string): boolean {
    return this.selectedMusicStyles.includes(style);
  }

  // ========================================
  // VÉRIFICATION EMAIL
  // ========================================

  /**
   * Envoie un email de vérification
   */
  async sendVerificationEmail() {
    this.isLoadingVerification = true;

    try {
      await this.authService.sendEmailVerification();
      this.showToast('Email de vérification envoyé', 'success');
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      this.showToast('Erreur lors de l\'envoi', 'danger');
    } finally {
      this.isLoadingVerification = false;
    }
  }

  /**
   * Rafraîchit le statut de vérification email
   */
  async refreshEmailStatus() {
    this.isLoadingVerification = true;

    try {
      const isVerified = await this.authService.checkEmailVerified();
      
      if (isVerified) {
        this.isEmailVerified = true;
        this.showToast('Email vérifié avec succès !', 'success');
        
        // Met à jour Firestore
        if (this.userId) {
          this.usersService.updateUserProfile(this.userId, {}).subscribe();
        }
      } else {
        this.showToast('Email non encore vérifié', 'warning');
      }
    } catch (error) {
      console.error('❌ Erreur vérification:', error);
      this.showToast('Erreur lors de la vérification', 'danger');
    } finally {
      this.isLoadingVerification = false;
    }
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  /**
   * Gère le rafraîchissement
   */
  handleRefresh(event: any) {
    if (this.userId) {
      this.loadUserProfile();
    }
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  /**
   * Calcule l'ancienneté du membre
   */
  getMemberSince(): string {
    if (!this.user?.createdAt) return '0';
    
    const now = Date.now();
    const createdAt = this.user.createdAt.toMillis();
    const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return '1 jour';
    if (diffDays < 7) return `${diffDays} jours`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem.`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mois`;
    return `${Math.floor(diffDays / 365)} an${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
  }

  /**
   * ✅ NOUVEAU : Navigation vers la recherche d'amis
   */
  goToFriendSearch() {
    console.log('👥 [ProfilePage] Navigation vers recherche d\'amis');
    this.router.navigate(['/social/friend-search']);
  }

  /**
   * Déconnexion
   */
  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Déconnexion',
      message: 'Êtes-vous sûr de vouloir vous déconnecter ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Se déconnecter',
          role: 'destructive',
          handler: () => {
            this.authService.logout().subscribe({
              next: () => {
                console.log('✅ Déconnexion réussie');
                this.router.navigate(['/login']);
              },
              error: (error) => {
                console.error('❌ Erreur déconnexion:', error);
                this.showToast('Erreur lors de la déconnexion', 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
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
}