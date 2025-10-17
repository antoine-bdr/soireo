// src/app/features/auth/login/login.page.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonIcon,
  IonSpinner,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline, logoGoogle, logInOutline } from 'ionicons/icons';

// Import du service d'authentification
import { AuthenticationService } from '../../../core/services/authentication.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonText,
    IonIcon
  ]
})
export class LoginPage {
  // Injection des services via inject() (approche moderne Angular)
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  
  // Formulaire réactif avec validation
  loginForm: FormGroup;
  
  // État de chargement pour désactiver les boutons pendant la connexion
  isLoading = false;

  constructor() {
    // Enregistrement des icônes Ionicons
    addIcons({ mailOutline, lockClosedOutline, logoGoogle, logInOutline });
    
    // Création du formulaire avec validations
    this.loginForm = this.fb.group({
      email: ['', [
        Validators.required,           // Champ obligatoire
        Validators.email               // Format email valide
      ]],
      password: ['', [
        Validators.required,           // Champ obligatoire
        Validators.minLength(6)        // Minimum 6 caractères
      ]]
    });
  }

  /**
   * Connexion avec email et mot de passe
   */
  async login() {
    // Vérification de la validité du formulaire
    if (this.loginForm.invalid) {
      this.showToast('Veuillez remplir tous les champs correctement', 'warning');
      return;
    }

    // Affichage d'un loader pendant la connexion
    const loading = await this.loadingCtrl.create({
      message: 'Connexion en cours...',
      spinner: 'crescent'
    });
    await loading.present();

    // Récupération des valeurs du formulaire
    const { email, password } = this.loginForm.value;

    // Appel du service d'authentification
    this.authService.login(email, password).subscribe({
      // En cas de succès
      next: async (credential) => {
        await loading.dismiss();
        await this.showToast(`Bienvenue ${credential.user.displayName || email} !`, 'success');
        
        // Navigation vers la page d'accueil
        this.router.navigate(['/home']);
      },
      // En cas d'erreur
      error: async (error) => {
        await loading.dismiss();
        
        // Gestion des erreurs Firebase
        let errorMessage = 'Une erreur est survenue';
        
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'Aucun compte associé à cet email';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Mot de passe incorrect';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Email invalide';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Ce compte a été désactivé';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Trop de tentatives. Réessayez plus tard';
            break;
          default:
            errorMessage = error.message || 'Erreur de connexion';
        }
        
        this.showToast(errorMessage, 'danger');
        console.error('Erreur de connexion:', error);
      }
    });
  }

  /**
   * Connexion avec Google
   */
  async signInWithGoogle() {
    const loading = await this.loadingCtrl.create({
      message: 'Connexion avec Google...',
      spinner: 'crescent'
    });
    await loading.present();

    this.authService.signInWithGoogle().subscribe({
      next: async (credential) => {
        await loading.dismiss();
        await this.showToast(`Bienvenue ${credential.user.displayName} !`, 'success');
        this.router.navigate(['/home']);
      },
      error: async (error) => {
        await loading.dismiss();
        
        let errorMessage = 'Erreur de connexion avec Google';
        
        if (error.code === 'auth/popup-closed-by-user') {
          errorMessage = 'Connexion annulée';
        } else if (error.code === 'auth/popup-blocked') {
          errorMessage = 'Popup bloquée par le navigateur';
        }
        
        this.showToast(errorMessage, 'danger');
        console.error('Erreur Google Sign-In:', error);
      }
    });
  }

  /**
   * Affiche un message toast (notification)
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
   * Getters pour faciliter l'accès aux contrôles du formulaire dans le template
   */
  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }
}