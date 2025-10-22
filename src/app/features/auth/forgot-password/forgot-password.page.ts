import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent,
  IonButton,
  IonInput,
  IonLabel,
  IonIcon,
  IonText,
  IonSpinner,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack, 
  lockClosed, 
  mail, 
  paperPlane, 
  checkmarkCircle, 
  informationCircle, 
  logIn, 
  reload,
  alertCircle 
} from 'ionicons/icons';
import { AuthenticationService } from '../../../core/services/authentication.service';

/**
 * 🔐 Page de réinitialisation de mot de passe (STANDALONE)
 * Permet à l'utilisateur de recevoir un email pour réinitialiser son mot de passe
 */
@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonButton,
    IonInput,
    IonLabel,
    IonIcon,
    IonText,
    IonSpinner
  ]
})
export class ForgotPasswordPage implements OnInit {
  
  // Injection des services
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);
  
  // Formulaire réactif
  forgotPasswordForm!: FormGroup;
  
  // État de soumission
  isSubmitting = false;
  
  // Email envoyé avec succès
  emailSent = false;

  constructor() {
    // Enregistrement des icônes Ionicons
    addIcons({
      arrowBack,
      lockClosed,
      mail,
      paperPlane,
      checkmarkCircle,
      informationCircle,
      logIn,
      reload,
      alertCircle
    });
  }

  ngOnInit() {
    this.initForm();
  }

  /**
   * Initialise le formulaire avec validation
   */
  private initForm(): void {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      ]]
    });
  }

  /**
   * Soumet la demande de réinitialisation
   */
  async onSubmit(): Promise<void> {
    // Vérifier la validité du formulaire
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    const email = this.forgotPasswordForm.value.email.trim();
    
    // Afficher le loader
    const loading = await this.loadingController.create({
      message: 'Envoi en cours...',
      spinner: 'circular'
    });
    await loading.present();

    // Envoyer l'email de réinitialisation (Observable)
    this.authService.resetPassword(email).subscribe({
      next: async () => {
        this.isSubmitting = false;
        
        // Marquer l'email comme envoyé
        this.emailSent = true;
        
        // Afficher le toast de succès
        await this.showToast(
          '✅ Email envoyé !',
          `Un email de réinitialisation a été envoyé à ${email}. Vérifiez votre boîte de réception.`,
          'success'
        );
        
        await loading.dismiss();
      },
      error: async (error: any) => {
        this.isSubmitting = false;
        console.error('Erreur reset password:', error);
        
        // Afficher le toast d'erreur
        await this.showToast(
          '❌ Erreur',
          error.message || 'Impossible d\'envoyer l\'email. Vérifiez l\'adresse saisie.',
          'danger'
        );
        
        await loading.dismiss();
      }
    });
  }

  /**
   * Retour à la page de connexion
   */
  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Réessayer avec un autre email
   */
  resetForm(): void {
    this.emailSent = false;
    this.forgotPasswordForm.reset();
  }

  /**
   * Affiche un toast (notification)
   */
  private async showToast(header: string, message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      header: header,
      message: message,
      duration: 5000,
      position: 'top',
      color: color,
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  /**
   * Getters pour accéder facilement aux contrôles du formulaire
   */
  get email() {
    return this.forgotPasswordForm.get('email');
  }

  /**
   * Vérifie si un champ a une erreur et a été touché
   */
  hasError(controlName: string, errorName: string): boolean {
    const control = this.forgotPasswordForm.get(controlName);
    return !!(control && control.hasError(errorName) && control.touched);
  }
}