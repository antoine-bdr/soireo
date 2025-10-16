import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile/profile.page').then( m => m.ProfilePage)
  },
  {
    path: 'event-list',
    loadComponent: () => import('./features/events/event-list/event-list.page').then( m => m.EventListPage)
  },
  {
    path: 'event-detail',
    loadComponent: () => import('./features/events/event-detail/event-detail.page').then( m => m.EventDetailPage)
  },
  {
    path: 'event-create',
    loadComponent: () => import('./features/events/event-create/event-create.page').then( m => m.EventCreatePage)
  },
  {
    path: 'map',
    loadComponent: () => import('./features/map/map/map.page').then( m => m.MapPage)
  },
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.page').then( m => m.TabsPage)
  },
];
