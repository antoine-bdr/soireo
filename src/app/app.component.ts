// src/app/app.component.ts
// Composant racine de l'application

import { Component, inject, OnInit } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { migrateAddressVisibility } from './core/migrations/migrate-adress-visibility';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  // IMPORTANT : Importer les composants Ionic depuis @ionic/angular/standalone
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private firestore = inject(Firestore);
  
  async ngOnInit() {
    // Vérifier si migration déjà effectuée
    const migrationDone = localStorage.getItem('addressVisibilityMigrated');
    
    if (!migrationDone) {
      try {
        console.log('🔄 Lancement migration AddressVisibility...');
        await migrateAddressVisibility(this.firestore);
        localStorage.setItem('addressVisibilityMigrated', 'true');
        console.log('✅ Migration terminée et marquée');
      } catch (error) {
        console.error('❌ Erreur migration:', error);
      }
    } else {
      console.log('ℹ️ Migration déjà effectuée, skip');
    }
  }
}