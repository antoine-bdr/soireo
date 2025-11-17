// src/app/core/guards/event-access.guard.ts
// ✅ MODIFIÉ : Autorise l'accès aux INVITE_ONLY pour tous les connectés
// L'affichage conditionnel (invitation/message) est géré dans le template

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EventsService } from '../services/events.service';
import { AuthenticationService } from '../services/authentication.service';
import { EventAccessType } from '../models/event.model';

export const eventAccessGuard: CanActivateFn = async (route, state) => {
  const eventId = route.paramMap.get('id');
  
  if (!eventId) {
    console.error('❌ eventAccessGuard: Pas d\'ID événement');
    return false;
  }

  const eventsService = inject(EventsService);
  const authService = inject(AuthenticationService);
  const router = inject(Router);

  try {
    const event = await firstValueFrom(eventsService.getEventById(eventId));
    const userId = authService.getCurrentUserId();

    // ✅ Vérifier que l'événement existe
    if (!event) {
      console.error('❌ Événement introuvable');
      router.navigate(['/tabs/events']);
      return false;
    }

    // ✅ Non connecté → Redirection vers login
    if (!userId) {
      console.log('🔒 Non connecté, redirect login');
      router.navigate(['/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    // ✅ Utilisateur connecté → Autoriser l'accès
    // La gestion de l'affichage (invitation/message) se fait dans event-detail.page.html
    console.log('✅ Accès autorisé pour utilisateur connecté');
    return true;

  } catch (error) {
    console.error('❌ Erreur eventAccessGuard:', error);
    router.navigate(['/tabs/events']);
    return false;
  }
};