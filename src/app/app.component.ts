// src/app/app.component.ts
// Composant racine de l'application

import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  // IMPORTANT : Importer les composants Ionic depuis @ionic/angular/standalone
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    console.log('🚀 Application Party Events initialisée');
  }
}