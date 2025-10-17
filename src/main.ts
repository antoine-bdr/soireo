import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

// 🔥 IMPORTS FIREBASE
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import {
  provideAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserSessionPersistence,
  getAuth
} from '@angular/fire/auth';
import {
  provideFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
  getFirestore
} from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { Capacitor } from '@capacitor/core';

if (environment.production) {
  enableProdMode();
}

const useEmulators = !environment.production && environment.useEmulators;

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    // 🔥 FIREBASE PROVIDERS
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),

    // Auth avec support Capacitor (iOS/Android)
    provideAuth(() => {
      if (Capacitor.isNativePlatform()) {
        return initializeAuth(getApp(), {
          persistence: indexedDBLocalPersistence,
        });
      } else {
        const auth = initializeAuth(getApp(), {
          persistence: useEmulators ? browserSessionPersistence : indexedDBLocalPersistence
        });
        return auth;
      }
    }),

    // Firestore avec émulateur optionnel
    provideFirestore(() => {
      const firestore = initializeFirestore(getApp(), {
        experimentalForceLongPolling: useEmulators ? true : false
      });

      if (useEmulators) {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
        console.log('🧪 Mode émulateur Firestore activé');
      }

      return firestore;
    }),

    // Storage
    provideStorage(() => getStorage()),
  ],
}).catch(err => console.error(err));