import { Component } from '@angular/core';
import { 
  IonTabs, 
  IonTabBar, 
  IonTabButton, 
  IonIcon, 
  IonLabel,
  IonFab,
  IonFabButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendar, star, person, add } from 'ionicons/icons';
import { Router } from '@angular/router';

/**
 * 🧭 Tabs Page - Navigation principale de l'application
 * 
 * Contient 3 tabs :
 * 1. Événements (liste complète)
 * 2. Mes Events (créations + participations)
 * 3. Profil
 * 
 * + FAB (Floating Action Button) pour créer un événement
 */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonFab,
    IonFabButton
  ]
})
export class TabsPage {

  constructor(private router: Router) {
    // Enregistrement des icônes Ionicons
    addIcons({ calendar, star, person, add });
  }

  /**
   * Navigation vers la création d'événement
   * Appelée par le FAB
   */
  navigateToCreateEvent() {
    this.router.navigate(['/events/create']);
  }
}