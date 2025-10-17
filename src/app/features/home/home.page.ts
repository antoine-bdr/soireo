// src/app/features/home/home.page.ts
// Page d'accueil (temporaire - on développera le contenu plus tard)

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonText,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, personCircleOutline, calendarOutline } from 'ionicons/icons';

import { AuthenticationService } from '../../core/services/authentication.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonText
  ]
})
export class HomePage {
  // Injection des services
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  // Signal pour stocker les infos utilisateur
  userName = signal<string>('');
  userEmail = signal<string>('');

  constructor() {
    addIcons({ logOutOutline, personCircleOutline });
    
    // Récupère les infos de l'utilisateur connecté
    this.authService.getUser().subscribe(user => {
      if (user) {
        this.userName.set(user.displayName || 'Utilisateur');
        this.userEmail.set(user.email || '');
      }
    });
  }

  /**
   * Navigation vers la liste des événements
   */
  goToEvents() {
    this.router.navigate(['/events']);
  }

  /**
   * Déconnexion
   */
  async logout() {
    this.authService.logout().subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: 'Déconnexion réussie',
          duration: 2000,
          position: 'top',
          color: 'success'
        });
        await toast.present();
        
        // Redirection vers login
        this.router.navigate(['/login']);
      },
      error: async (error) => {
        console.error('Erreur de déconnexion:', error);
        const toast = await this.toastCtrl.create({
          message: 'Erreur lors de la déconnexion',
          duration: 2000,
          position: 'top',
          color: 'danger'
        });
        await toast.present();
      }
    });
  }
}