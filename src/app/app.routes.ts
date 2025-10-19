import { Routes } from '@angular/router';
import { authGuard } from '../app/core/guards/auth-guard';

/**
 * 🛣️ Configuration des routes de l'application
 * 
 * Structure :
 * - Auth (login, register) - Accessible sans authentification
 * - Tabs (navigation principale) - Protégé par AuthGuard
 *   ├── Events (liste complète)
 *   ├── My-Events (mes créations + participations)
 *   └── Profile
 * - Events (CRUD) - Protégé par AuthGuard
 */
export const routes: Routes = [
  // 🏠 Redirection racine → Tabs (Événements)
  {
    path: '',
    redirectTo: '/tabs/events',
    pathMatch: 'full'
  },

  // 🔐 Routes d'authentification (NON protégées)
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.page').then(m => m.RegisterPage)
  },

  // 🧭 Tabs - Navigation principale (PROTÉGÉ)
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.page').then(m => m.TabsPage),
    canActivate: [authGuard],
    children: [
      // Tab 1 : Liste des événements
      {
        path: 'events',
        loadComponent: () => import('./features/events/event-list/event-list.page').then(m => m.EventListPage)
      },
      
      // Tab 2 : Mes événements
      {
        path: 'my-events',
        loadComponent: () => import('./features/events/my-events/my-events.page').then(m => m.MyEventsPage)
      },
      
      // Tab 3 : Profil
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then(m => m.ProfilePage)
      },
      
      // Redirection par défaut dans tabs
      {
        path: '',
        redirectTo: 'events',
        pathMatch: 'full'
      }
    ]
  },

  // 📅 Routes CRUD Événements (PROTÉGÉ)
  {
    path: 'events',
    canActivate: [authGuard],
    children: [
      // Créer événement
      {
        path: 'create',
        loadComponent: () => import('./features/events/event-create/event-create.page').then(m => m.EventCreatePage)
      },
      
      // Détail événement
      {
        path: ':id',
        loadComponent: () => import('./features/events/event-detail/event-detail.page').then(m => m.EventDetailPage)
      },
      
      // Éditer événement
      {
        path: ':id/edit',
        loadComponent: () => import('./features/events/event-edit/event-edit.page').then(m => m.EventEditPage)
      }
    ]
  },

  // 🚫 Route 404 (fallback)
  {
    path: '**',
    redirectTo: '/tabs/events'
  }
];