import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmailVerificationBannerComponent } from './../shared/components/email-verification-banner/email-verification-banner.component'; // ✅ AJOUT
import { 
  IonTabs, 
  IonTabBar, 
  IonTabButton, 
  IonIcon, 
  IonLabel,
  IonFab,
  IonFabButton, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendar, star, person, add } from 'ionicons/icons';
import { Router } from '@angular/router';
import { AuthenticationService } from '../core/services/authentication.service';

/**
 * 🧭 Tabs Page - Navigation principale de l'application
 * 
 * Contient 3 tabs :
 * 1. Événements (liste complète)
 * 2. Mes Events (créations + participations)
 * 3. Profil
 * 
 * + FAB (Floating Action Button) - visible sauf sur Profil
 */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  imports: [IonBadge, 
    CommonModule,        // ⭐ AJOUT CRITIQUE pour *ngIf
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonFab,
    IonFabButton,
    IonBadge,
    EmailVerificationBannerComponent
  ]
})
export class TabsPage implements AfterViewInit {
  @ViewChild(IonTabs) tabs!: IonTabs;

  showFab = true; // Contrôle la visibilité du FAB
  isEmailVerified = true;

  constructor(private router: Router,
    private authService: AuthenticationService
  ) {
    // Enregistrement des icônes Ionicons
    addIcons({ calendar, star, person, add });
  }

  /**
   * Après l'initialisation de la vue
   * Vérifie le tab actif au démarrage
   */
  ngAfterViewInit() {
    // Petit délai pour laisser les tabs s'initialiser
    setTimeout(() => {
      this.updateFabVisibility();
    }, 100);
  }

  private checkEmailVerification() {
    const user = this.authService.currentUser();
    this.isEmailVerified = user?.emailVerified || false;
  }

  /**
   * Appelé quand on change de tab
   * ✅ Masque le FAB uniquement sur le profil
   */
  ionTabsDidChange() {
    this.updateFabVisibility();
  }

  /**
   * Met à jour la visibilité du FAB selon le tab actif
   */
  private updateFabVisibility() {
    const currentTab = this.tabs?.getSelected();
    
    if (currentTab) {
      // Cache le FAB uniquement sur le profil
      this.showFab = currentTab !== 'profile';
      console.log('🧭 Tab actif:', currentTab, '| FAB visible:', this.showFab);
    } else {
      // Si on ne peut pas détecter le tab, affiche le FAB par défaut
      this.showFab = true;
      console.log('⚠️ Tab non détecté, FAB visible par défaut');
    }
  }

  /**
   * Navigation vers la création d'événement
   * Appelée par le FAB
   */
  navigateToCreateEvent() {
    console.log('➕ Navigation vers création d\'événement');
    this.router.navigate(['/events/create']);
  }
}