// src/app/app.routes.ts
// Configuration de toutes les routes de l'application

import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards/auth-guard';

/**
 * Structure des routes :
 * 
 * Routes publiques (accessibles sans connexion) :
 *   /login    → Page de connexion
 *   /register → Page d'inscription
 * 
 * Routes protégées (nécessitent une connexion via authGuard) :
 *   /home     → Page d'accueil
 *   /profile  → Profil utilisateur (à créer plus tard)
 *   /events   → Liste des événements (à créer plus tard)
 * 
 * Redirection par défaut :
 *   / → Redirige vers /login
 */
export const routes: Routes = [
  // ========================================
  // REDIRECTION PAR DÉFAUT
  // ========================================
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // ========================================
  // ROUTES PUBLIQUES (non protégées)
  // ========================================
  // Ces routes utilisent noAuthGuard pour rediriger les utilisateurs
  // déjà connectés vers /home automatiquement
  
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPage),
    canActivate: [noAuthGuard] // Redirige vers /home si déjà connecté
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.page').then(m => m.RegisterPage),
    canActivate: [noAuthGuard] // Redirige vers /home si déjà connecté
  },

  // ========================================
  // ROUTES PROTÉGÉES (nécessitent une connexion)
  // ========================================
  // Ces routes utilisent authGuard qui vérifie l'authentification
  // et redirige vers /login si non connecté
  
  {
    path: 'home',
    loadComponent: () => import('./features/home/home.page').then(m => m.HomePage),
    canActivate: [authGuard] // Protection : nécessite une connexion
  },

  // ========================================
  // ROUTES FUTURES (à implémenter)
  // ========================================
  // Décommente ces routes au fur et à mesure que tu crées les pages
  /*
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.page').then(m => m.ProfilePage),
    canActivate: [authGuard]
  },*/
  {
    path: 'events',
    loadComponent: () => import('./features/events/event-list/event-list.page').then(m => m.EventListPage),
    canActivate: [authGuard]
  },
  {
    path: 'events/create',
    loadComponent: () => import('./features/events/event-create/event-create.page').then(m => m.EventCreatePage),
    canActivate: [authGuard]
  },
  {
    path: 'events/:id',
    loadComponent: () => import('./features/events/event-detail/event-detail.page').then(m => m.EventDetailPage),
    canActivate: [authGuard]
  },
  /*
  {
    path: 'map',
    loadComponent: () => import('./features/map/map.page').then(m => m.MapPage),
    canActivate: [authGuard]
  },
  {
    path: 'chat/:eventId',
    loadComponent: () => import('./features/chat/chat.page').then(m => m.ChatPage),
    canActivate: [authGuard]
  },*/

  // ========================================
  // ROUTE 404 (page non trouvée)
  // ========================================
  {
    path: '**',
    redirectTo: 'login'
  },
  {
    path: 'event-edit',
    loadComponent: () => import('./app/features/events/event-edit/event-edit.page').then( m => m.EventEditPage)
  },
  {
    path: 'events',
    loadComponent: () => import('./app/features/events/events.page').then( m => m.EventsPage)
  }
];