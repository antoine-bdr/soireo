// src/app/shared/components/email-verification-banner/email-verification-banner.component.ts
// Composant Banner de vérification d'email
// ✅ Version FINALE : Réapparaît à chaque démarrage

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { addIcons } from 'ionicons';
import { 
  mailOutline, 
  refreshOutline, 
  checkmarkCircleOutline, 
  close 
} from 'ionicons/icons';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-email-verification-banner',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './email-verification-banner.component.html',
  styleUrls: ['./email-verification-banner.component.scss']
})
export class EmailVerificationBannerComponent implements OnInit, OnDestroy {
  // ========================================
  // INJECTION DES DÉPENDANCES
  // ========================================
  private readonly authService = inject(AuthenticationService);
  private readonly toastController = inject(ToastController);

  // ========================================
  // ÉTAT DU COMPOSANT
  // ========================================
  showBanner = false;
  isLoading = false;
  userEmail: string | null = null;
  
  private authSubscription?: Subscription;

  constructor() {
    // Enregistrement des icônes
    addIcons({
      mailOutline,
      refreshOutline,
      checkmarkCircleOutline,
      close
    });
  }

  // ========================================
  // LIFECYCLE
  // ========================================
  ngOnInit() {
    // Écouter les changements d'utilisateur
    this.authSubscription = this.authService.getUser().subscribe(user => {
      this.checkEmailVerificationStatus();
    });
    
    this.checkEmailVerificationStatus();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  // ========================================
  // VÉRIFICATION DU STATUT
  // ========================================

  /**
   * Vérifie si l'email est vérifié et affiche le banner si nécessaire
   * ✅ SIMPLIFIÉ : Pas de persistance, réapparaît à chaque démarrage
   */
  checkEmailVerificationStatus() {
    const user = this.authService.currentUser();
    
    if (!user) {
      this.showBanner = false;
      return;
    }

    // Si l'email est déjà vérifié, ne pas afficher le banner
    if (user.emailVerified) {
      this.showBanner = false;
      return;
    }

    // Email non vérifié → Afficher le banner
    this.showBanner = true;
    this.userEmail = user.email;
    console.log('⚠️ Email non vérifié pour:', this.userEmail);
  }

  // ========================================
  // ACTIONS
  // ========================================

  /**
   * Renvoie l'email de vérification
   */
  resendVerificationEmail() {
    this.isLoading = true;

    this.authService.sendEmailVerification().subscribe({
      next: async () => {
        this.isLoading = false;
        await this.showSuccessToast();
      },
      error: async (error) => {
        this.isLoading = false;
        console.error('❌ Erreur lors de l\'envoi:', error);
        await this.showErrorToast();
      }
    });
  }

  /**
   * Rafraîchit le statut de vérification
   */
  refreshVerificationStatus() {
    this.isLoading = true;

    this.authService.reloadEmailVerificationStatus().subscribe({
      next: async (isVerified) => {
        this.isLoading = false;
        
        if (isVerified) {
          // Email vérifié ! Cache le banner définitivement
          this.showBanner = false;
          await this.showVerifiedToast();
        } else {
          await this.showNotVerifiedToast();
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('❌ Erreur lors du rafraîchissement:', error);
      }
    });
  }

  /**
   * Ferme le banner temporairement (jusqu'au prochain démarrage)
   * ✅ SIMPLIFIÉ : Cache juste le banner sans persistance
   */
  dismissBanner() {
    this.showBanner = false;
    console.log('🚫 Banner fermé (réapparaîtra au prochain démarrage)');
  }

  // ========================================
  // TOASTS
  // ========================================

  private async showSuccessToast() {
    const toast = await this.toastController.create({
      message: `📧 Email de vérification envoyé à ${this.userEmail}`,
      duration: 3000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle'
    });
    await toast.present();
  }

  private async showVerifiedToast() {
    const toast = await this.toastController.create({
      message: '✅ Email vérifié avec succès !',
      duration: 3000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle'
    });
    await toast.present();
  }

  private async showNotVerifiedToast() {
    const toast = await this.toastController.create({
      message: '⚠️ Email non vérifié. Vérifiez votre boîte mail.',
      duration: 3000,
      position: 'top',
      color: 'warning',
      icon: 'alert-circle'
    });
    await toast.present();
  }

  private async showErrorToast() {
    const toast = await this.toastController.create({
      message: '❌ Erreur lors de l\'envoi. Réessayez plus tard.',
      duration: 3000,
      position: 'top',
      color: 'danger',
      icon: 'close-circle'
    });
    await toast.present();
  }
}