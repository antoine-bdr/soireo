// src/app/core/guards/event-access.guard.ts
// ✅ NOUVEAU (ÉTAPE 5) - Protège accès événements INVITE_ONLY

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EventsService } from '../services/events.service';
import { AuthenticationService } from '../services/authentication.service';
import { ParticipantsService } from '../services/participants.service';
import { EventAccessType } from '../models/event.model';

export const eventAccessGuard: CanActivateFn = async (route, state) => {
  const eventId = route.paramMap.get('id');
  
  if (!eventId) {
    console.error('❌ eventAccessGuard: Pas d\'ID événement');
    return false;
  }

  const eventsService = inject(EventsService);
  const authService = inject(AuthenticationService);
  const participantsService = inject(ParticipantsService);
  const router = inject(Router);

  try {
    const event = await firstValueFrom(eventsService.getEventById(eventId));
    const userId = authService.getCurrentUserId();

    // Non connecté → Login
    if (!userId) {
      console.log('🔒 Non connecté, redirect login');
      router.navigate(['/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    // Organisateur → OK
    if (event?.organizerId === userId) {
      return true;
    }

    // INVITE_ONLY → Vérifier participation
    if (event?.accessType === EventAccessType.INVITE_ONLY) {
      const participant = await firstValueFrom(
        participantsService.getParticipantDocumentRealtime(eventId, userId)
      );

      if (!participant) {
        console.log('❌ Non participant INVITE_ONLY');
        router.navigate(['/tabs/events'], {
          queryParams: { 
            error: 'invite_only',
            eventTitle: event.title 
          }
        });
        return false;
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Erreur eventAccessGuard:', error);
    router.navigate(['/tabs/events']);
    return false;
  }
};