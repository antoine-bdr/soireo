// src/main.ts - Configuration corrigée
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';

// Firebase imports
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideAuth, getAuth, initializeAuth, indexedDBLocalPersistence } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

// Capacitor pour détection plateforme native
import { Capacitor } from '@capacitor/core';

// Configuration de l'app
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// Active le mode production si défini dans environment
if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    // Ionic configuration
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    
    provideIonicAngular({
      mode: 'md',
      rippleEffect: true,
      animated: true,
      backButtonText: 'Retour',
      swipeBackEnabled: true,
    }),
    
    // Router avec preloading
    provideRouter(routes, withPreloading(PreloadAllModules)),
    
    // HTTP Client
    provideHttpClient(),
    
    // ========================================
    // FIREBASE CONFIGURATION (SIMPLIFIÉE)
    // ========================================
    
    // 1. Initialisation de l'app Firebase
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    
    // 2. Firebase Authentication (avec support Capacitor)
    provideAuth(() => {
      if (Capacitor.isNativePlatform()) {
        // Sur mobile natif : utiliser IndexedDB
        return initializeAuth(getApp(), {
          persistence: indexedDBLocalPersistence,
        });
      } else {
        // Sur web : authentification par défaut
        return getAuth();
      }
    }),
    
    // 3. Firebase Firestore (SIMPLIFIÉ)
    provideFirestore(() => getFirestore()),
    
    // 4. Firebase Storage
    provideStorage(() => getStorage()),
  ],
})
.catch(err => console.error('Erreur de bootstrap:', err));