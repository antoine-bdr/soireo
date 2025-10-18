// src/app/features/home/home.page.ts
// ✅ Vérifie que ces imports Ionic sont présents

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router'; // ✅ IMPORTANT : RouterLink
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonButtons, // ✅ IMPORTANT : Pour le container de boutons
  IonIcon,
  IonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, 
  personOutline,    // ✅ IMPORTANT : Pour le bouton profil
  calendarOutline, 
  logOutOutline 
} from 'ionicons/icons';
import { AuthenticationService } from '../../core/services/authentication.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink, // ✅ IMPORTANT : Pour [routerLink]
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonButtons, // ✅ IMPORTANT
    IonIcon,
    IonText
  ]
})
export class HomePage implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);

  // Signals pour afficher les infos utilisateur
  userName = signal<string>('');
  userEmail = signal<string>('');

  constructor() {
    // Enregistrement des icônes
    addIcons({
      personCircleOutline,
      personOutline, // ✅ IMPORTANT
      calendarOutline,
      logOutOutline
    });
  }

  ngOnInit() {
    // Récupère les infos utilisateur
    const displayName = this.authService.getCurrentUserDisplayName();
    const email = this.authService.getCurrentUserEmail();

    this.userName.set(displayName || email || 'Utilisateur');
    this.userEmail.set(email || '');
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
  logout() {
    this.authService.logout().subscribe({
      next: () => {
        console.log('👋 Déconnexion réussie');
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('❌ Erreur déconnexion:', error);
      }
    });
  }
}