import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
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
  LoadingController,
  ToastController,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline, personOutline, checkmarkCircleOutline, personAdd } from 'ionicons/icons';

import { AuthenticationService } from '../../../core/services/authentication.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
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
    IonSpinner,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonText,
    IonIcon
  ]
})
export class RegisterPage {
  // Injection des services
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  
  // Formulaire d'inscription avec validation personnalisée
  registerForm: FormGroup;
  
  isLoading = false;

  constructor() {
    // Enregistrement des icônes
    addIcons({personAdd,personOutline,mailOutline,lockClosedOutline,checkmarkCircleOutline});
    
    // Création du formulaire avec validations
    this.registerForm = this.fb.group({
      displayName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50)
      ]],
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(100)
      ]],
      confirmPassword: ['', [
        Validators.required
      ]]
    }, {
      // Validateur personnalisé pour vérifier que les mots de passe correspondent
      validators: this.passwordMatchValidator
    });
  }

  /**
   * Validateur personnalisé : vérifie que password et confirmPassword sont identiques
   */
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    // Si les champs n'existent pas encore, pas d'erreur
    if (!password || !confirmPassword) {
      return null;
    }

    // Si les mots de passe ne correspondent pas, retourne une erreur
    if (password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    // Sinon, tout est OK
    return null;
  }

  /**
   * Inscription avec email, mot de passe et nom
   */
  async register() {
    // Vérification de la validité du formulaire
    if (this.registerForm.invalid) {
      this.showToast('Veuillez remplir tous les champs correctement', 'warning');
      return;
    }

    // Affichage du loader
    const loading = await this.loadingCtrl.create({
      message: 'Création du compte...',
      spinner: 'crescent'
    });
    await loading.present();

    // Récupération des valeurs
    const { email, password, displayName } = this.registerForm.value;

    // Appel du service d'inscription
    this.authService.signup(email, password, displayName).subscribe({
      next: async (credential) => {
        await loading.dismiss();
        await this.showToast(`Bienvenue ${displayName} ! Votre compte a été créé.`, 'success');
        
        // Navigation vers la page d'accueil
        this.router.navigate(['/home']);
      },
      error: async (error) => {
        await loading.dismiss();
        
        // Gestion des erreurs Firebase
        let errorMessage = 'Une erreur est survenue lors de l\'inscription';
        
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Cet email est déjà utilisé';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Email invalide';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Inscription désactivée';
            break;
          case 'auth/weak-password':
            errorMessage = 'Mot de passe trop faible';
            break;
          default:
            errorMessage = error.message || 'Erreur d\'inscription';
        }
        
        this.showToast(errorMessage, 'danger');
        console.error('Erreur d\'inscription:', error);
      }
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
  get displayName() {
    return this.registerForm.get('displayName');
  }

  get email() {
    return this.registerForm.get('email');
  }

  get password() {
    return this.registerForm.get('password');
  }

  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }
}