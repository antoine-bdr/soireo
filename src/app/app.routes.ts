// src/app/app.routes.ts
// Configuration de toutes les routes de l'application

import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards/auth-guard';

/**
 * 🔧 ORDRE DES ROUTES - TRÈS IMPORTANT !
 * 
 * Angular vérifie les routes dans l'ordre de déclaration.
 * Règles à respecter :
 * 1. Routes statiques AVANT routes avec paramètres
 * 2. Routes spécifiques AVANT routes génériques
 * 3. Wildcard (**) TOUJOURS EN DERNIER
 * 
 * ✅ BON :  'events/create' → 'events/:id' → 'events' → '**'
 * ❌ MAUVAIS : '**' → 'events/create' (jamais atteinte !)
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
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPage),
    canActivate: [noAuthGuard] // Redirige vers /home si déjà connecté
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.page').then(m => m.RegisterPage),
    canActivate: [noAuthGuard]
  },

  // ========================================
  // ROUTES PROTÉGÉES (nécessitent authentification)
  // ========================================
  
  // Page d'accueil
  {
    path: 'home',
    loadComponent: () => import('./features/home/home.page').then(m => m.HomePage),
    canActivate: [authGuard]
  },

  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.page').then(m => m.ProfilePage),
    canActivate: [authGuard]
  },

  // ========================================
  // ROUTES ÉVÉNEMENTS (ordre CRITIQUE)
  // ========================================
  
  // ⚠️ Routes statiques AVANT routes avec paramètres
  
  // 1️⃣ Route statique : Création d'événement
  {
    path: 'events/create',
    loadComponent: () => import('./features/events/event-create/event-create.page').then(m => m.EventCreatePage),
    canActivate: [authGuard]
  },

  // 2️⃣ Route avec paramètre : Édition
  {
    path: 'events/:id/edit',
    loadComponent: () => import('./features/events/event-edit/event-edit.page').then(m => m.EventEditPage),
    canActivate: [authGuard]
  },

  // 3️⃣ Route avec paramètre : Détail
  {
    path: 'events/:id',
    loadComponent: () => import('./features/events/event-detail/event-detail.page').then(m => m.EventDetailPage),
    canActivate: [authGuard]
  },

  // 4️⃣ Route base : Liste des événements
  {
    path: 'events',
    loadComponent: () => import('./features/events/event-list/event-list.page').then(m => m.EventListPage),
    canActivate: [authGuard]
  },

  // ========================================
  // 🆕 ROUTE MES ÉVÉNEMENTS (Sprint 3)
  // ========================================
  {
    path: 'my-events',
    loadComponent: () => import('./features/events/my-events/my-events.page').then(m => m.MyEventsPage),
    canActivate: [authGuard]
  },

  // ========================================
  // ROUTES FUTURES (commentées)
  // ========================================
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
  },
  */

  // ========================================
  // ⚠️ ROUTE WILDCARD - TOUJOURS EN DERNIER
  // ========================================
  // Cette route capture TOUTES les URLs non matchées
  // Elle DOIT être la dernière route du tableau
  {
    path: '**',
    redirectTo: 'login'
  }
];