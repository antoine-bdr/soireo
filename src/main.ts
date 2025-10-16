// src/main.ts
// Configuration complète du bootstrap de l'application Ionic avec Firebase

import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';

// Firebase imports
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { 
  provideAuth, 
  getAuth,
  initializeAuth, 
  indexedDBLocalPersistence,
  browserSessionPersistence
} from '@angular/fire/auth';
import { 
  provideFirestore, 
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator 
} from '@angular/fire/firestore';
import { provideStorage, getStorage, connectStorageEmulator } from '@angular/fire/storage';
import { provideFunctions, getFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';

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

// Détermine si on utilise les émulateurs Firebase (développement local)
const useEmulators = !environment.production && environment.useEmulators;

bootstrapApplication(AppComponent, {
  providers: [
    // Ionic configuration
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    
    // Configuration Ionic avec options personnalisées
    provideIonicAngular({
      mode: 'md', // 'ios' ou 'md' (Material Design) - laisse 'md' pour Android/Web par défaut
      rippleEffect: true,
      animated: true,
      backButtonText: 'Retour',
      swipeBackEnabled: true, // Geste retour sur iOS
    }),
    
    // Router avec preloading de tous les modules pour performance
    provideRouter(routes, withPreloading(PreloadAllModules)),
    
    // HTTP Client pour les requêtes API
    provideHttpClient(),
    
    // ========================================
    // FIREBASE CONFIGURATION
    // ========================================
    
    // 1. Initialisation de l'app Firebase (DOIT être en premier)
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    
    // 2. Firebase Analytics (optionnel, pour tracking)
    provideAnalytics(() => {
      if (environment.production) {
        return getAnalytics();
      }
      return null as any; // Pas d'analytics en dev
    }),
    
    // 3. Firebase Authentication
    // Configuration spéciale pour les plateformes natives (iOS/Android)
    provideAuth(() => {
      let auth;
      
      if (Capacitor.isNativePlatform()) {
        // Sur mobile natif : utiliser IndexedDB pour la persistance
        auth = initializeAuth(getApp(), {
          persistence: indexedDBLocalPersistence,
        });
      } else {
        // Sur web : utiliser la persistance par défaut ou session selon environnement
        if (useEmulators) {
          auth = initializeAuth(getApp(), {
            persistence: browserSessionPersistence // Session seulement en dev
          });
        } else {
          auth = getAuth(); // Persistance locale par défaut en prod web
        }
      }
      
      return auth;
    }),
    
    // 4. Firebase Firestore (base de données)
    provideFirestore(() => {
      const firestore = initializeFirestore(getApp(), {
        // Polling forcé en mode émulateur pour éviter les problèmes de connexion
        experimentalForceLongPolling: useEmulators ? true : false,
      });
      
      // Connexion à l'émulateur Firestore en développement local
      if (useEmulators) {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
        console.log('🔥 Firestore Emulator connecté sur localhost:8080');
      }
      
      return firestore;
    }),
    
    // 5. Firebase Storage (stockage de fichiers/images)
    provideStorage(() => {
      const storage = getStorage();
      
      // Connexion à l'émulateur Storage en développement local
      if (useEmulators) {
        connectStorageEmulator(storage, 'localhost', 9199);
        console.log('🔥 Storage Emulator connecté sur localhost:9199');
      }
      
      return storage;
    }),
    
    // 6. Firebase Functions (optionnel, pour Cloud Functions)
    provideFunctions(() => {
      const functions = getFunctions();
      
      // Connexion à l'émulateur Functions en développement local
      if (useEmulators) {
        connectFunctionsEmulator(functions, 'localhost', 5001);
        console.log('🔥 Functions Emulator connecté sur localhost:5001');
      }
      
      return functions;
    }),
  ],
})
.catch(err => console.error('Erreur de bootstrap:', err));