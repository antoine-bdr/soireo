// src/app/core/guards/auth.guard.ts
// Guard qui protège les routes nécessitant une authentification

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthenticationService } from '../services/authentication.service';

/**
 * Guard d'authentification (Functional Guard - approche moderne Angular)
 * 
 * Comment ça fonctionne :
 * 1. Vérifie si l'utilisateur est connecté via AuthenticationService
 * 2. Si OUI → autorise l'accès à la route
 * 3. Si NON → redirige vers /login
 * 
 * Utilisation dans app.routes.ts :
 * {
 *   path: 'home',
 *   component: HomePage,
 *   canActivate: [authGuard] ← Active la protection
 * }
 */
export const authGuard: CanActivateFn = (route, state) => {
  // Injection des services
  const authService = inject(AuthenticationService);
  const router = inject(Router);

  // Écoute l'état d'authentification
  return authService.getUser().pipe(
    take(1), // Prend seulement la première valeur émise (évite les fuites mémoire)
    map(user => {
      // Si l'utilisateur existe (connecté)
      if (user) {
        console.log('✅ Guard: Utilisateur authentifié, accès autorisé');
        return true; // Autorise l'accès
      } else {
        // Si pas d'utilisateur (non connecté)
        console.log('🚫 Guard: Utilisateur non authentifié, redirection vers /login');
        
        // Redirige vers la page de login
        router.navigate(['/login'], {
          queryParams: { returnUrl: state.url } // Sauvegarde l'URL demandée pour rediriger après connexion
        });
        
        return false; // Bloque l'accès
      }
    })
  );
};

/**
 * Guard inverse : Redirige les utilisateurs CONNECTÉS
 * Utile pour les pages login/register (si déjà connecté → va vers /home)
 * 
 * Utilisation :
 * {
 *   path: 'login',
 *   component: LoginPage,
 *   canActivate: [noAuthGuard] ← Redirige si déjà connecté
 * }
 */
export const noAuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthenticationService);
  const router = inject(Router);

  return authService.getUser().pipe(
    take(1),
    map(user => {
      // Si l'utilisateur est déjà connecté
      if (user) {
        console.log('✅ Guard: Utilisateur déjà connecté, redirection vers /home');
        router.navigate(['/home']); // Redirige vers l'accueil
        return false; // Bloque l'accès à login/register
      } else {
        // Si non connecté, autorise l'accès à login/register
        console.log('✅ Guard: Accès autorisé aux pages publiques');
        return true;
      }
    })
  );
};