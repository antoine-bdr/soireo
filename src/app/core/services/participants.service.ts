// src/app/core/services/participants.service.ts
// Service de gestion des participations aux événements
// ✅ VERSION FINALE COMPLÈTE avec réactivité temps réel optimale

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp
} from '@angular/fire/firestore';
import { Observable, from, map, switchMap, of, combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { 
  Participant, 
  ParticipantStatus,
  ParticipationStats 
} from '../models/participant.model';
import { Event } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class ParticipantsService {
  // Injection des dépendances
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  
  // Nom de la collection Firestore
  private readonly participantsCollection = 'participants';

  constructor() {}

  // ========================================
  // 🔵 REJOINDRE UN ÉVÉNEMENT
  // ========================================

  /**
   * Permet à un utilisateur de rejoindre un événement
   * Effectue les vérifications nécessaires puis ajoute le participant
   * 
   * @param eventId - ID de l'événement à rejoindre
   * @param event - Objet Event complet (pour les vérifications)
   * @returns Observable<void> qui se complète après l'ajout
   */
  joinEvent(eventId: string, event: Event): Observable<void> {
    const userId = this.authService.getCurrentUserId();
    const userName = this.authService.getCurrentUserDisplayName();
    const userEmail = this.authService.getCurrentUserEmail();

    if (!userId || !userEmail) {
      throw new Error('Utilisateur non connecté');
    }

    console.log('🔵 joinEvent appelé pour eventId:', eventId, 'userId:', userId);

    // Étape 1 : Vérifie que l'utilisateur ne participe pas déjà
    return this.getParticipantDocumentOneTime(eventId, userId).pipe(
      switchMap(existingParticipant => {
        if (existingParticipant) {
          console.log('⚠️ L\'utilisateur participe déjà');
          throw new Error('Vous participez déjà à cet événement');
        }

        console.log('✅ L\'utilisateur ne participe pas encore, vérifications en cours...');

        // Étape 2 : Vérifie que l'utilisateur peut rejoindre (une seule fois)
        return this.canJoinEventOneTime(event).pipe(
          switchMap(canJoin => {
            if (!canJoin.allowed) {
              console.log('⚠️ Impossible de rejoindre:', canJoin.reason);
              throw new Error(canJoin.reason || 'Impossible de rejoindre cet événement');
            }

            console.log('✅ Toutes les vérifications sont passées, création du participant...');

            // Étape 3 : Crée le document participant dans Firestore
            const participantData: Omit<Participant, 'id'> = {
              eventId,
              userId,
              userName: userName || userEmail,
              userEmail,
              userPhoto: '',
              joinedAt: Timestamp.now(),
              status: event.requiresApproval 
                ? ParticipantStatus.PENDING 
                : ParticipantStatus.APPROVED
            };

            const participantsRef = collection(this.firestore, this.participantsCollection);
            return from(addDoc(participantsRef, participantData)).pipe(
              map(() => {
                console.log('✅ Participant créé avec succès !');
                return void 0;
              })
            );
          })
        );
      })
    );
  }

  // ========================================
  // 🔴 QUITTER UN ÉVÉNEMENT
  // ========================================

  /**
   * Permet à un utilisateur de quitter un événement
   * Supprime le document participant correspondant
   * 
   * @param eventId - ID de l'événement à quitter
   * @returns Observable<void> qui se complète après la suppression
   */
  leaveEvent(eventId: string): Observable<void> {
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      throw new Error('Utilisateur non connecté');
    }

    console.log('🔴 leaveEvent appelé pour eventId:', eventId, 'userId:', userId);

    // Trouve le document de participation puis le supprime
    return this.getParticipantDocumentOneTime(eventId, userId).pipe(
      switchMap(participantDoc => {
        if (!participantDoc) {
          throw new Error('Vous ne participez pas à cet événement');
        }

        console.log('🗑️ Suppression du document participant:', participantDoc.id);
        const participantRef = doc(this.firestore, this.participantsCollection, participantDoc.id!);
        return from(deleteDoc(participantRef));
      })
    );
  }

  // ========================================
  // 📊 RÉCUPÉRATION DES PARTICIPANTS
  // ========================================

  /**
   * Récupère tous les participants approuvés d'un événement (TEMPS RÉEL)
   * Écoute en continu les changements dans Firestore
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<Participant[]> qui émet à chaque changement
   */
  getParticipants(eventId: string): Observable<Participant[]> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef, 
        where('eventId', '==', eventId),
        where('status', '==', ParticipantStatus.APPROVED),
        orderBy('joinedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Participant[];
        
        console.log(`👥 getParticipants: ${participants.length} participants trouvés`);
        observer.next(participants);
      }, (error) => {
        console.error('❌ Erreur getParticipants:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère toutes les participations d'un utilisateur (TEMPS RÉEL)
   * Utilisé dans "Mes Événements" pour afficher les participations
   * 
   * @param userId - ID de l'utilisateur
   * @returns Observable<Participant[]> qui émet à chaque changement
   */
  getParticipationsByUser(userId: string): Observable<Participant[]> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef, 
        where('userId', '==', userId),
        orderBy('joinedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Participant[];
        
        console.log(`👤 getParticipationsByUser: ${participations.length} participations trouvées`);
        observer.next(participations);
      }, (error) => {
        console.error('❌ Erreur getParticipationsByUser:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère les participations en attente d'approbation (TEMPS RÉEL)
   * Utilisé par les organisateurs pour gérer les demandes
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<Participant[]> qui émet à chaque changement
   */
  getPendingParticipants(eventId: string): Observable<Participant[]> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef,
        where('eventId', '==', eventId),
        where('status', '==', ParticipantStatus.PENDING),
        orderBy('joinedAt', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const pending = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Participant[];
        
        console.log(`⏳ getPendingParticipants: ${pending.length} en attente`);
        observer.next(pending);
      }, (error) => {
        console.error('❌ Erreur getPendingParticipants:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // ✅ VÉRIFICATIONS - TEMPS RÉEL
  // ========================================

  /**
   * Vérifie si un utilisateur participe à un événement (TEMPS RÉEL)
   * Écoute en continu les changements
   * 
   * ⚡ Cette méthode est RÉACTIVE : elle émet une nouvelle valeur à chaque changement
   * 
   * @param eventId - ID de l'événement
   * @param userId - ID de l'utilisateur (optionnel, utilise l'utilisateur connecté par défaut)
   * @returns Observable<boolean> qui émet true/false en temps réel
   */
  isUserParticipating(eventId: string, userId?: string): Observable<boolean> {
    const uid = userId || this.authService.getCurrentUserId();
    
    if (!uid) {
      return of(false);
    }

    console.log('🔍 isUserParticipating (TEMPS RÉEL) pour eventId:', eventId, 'userId:', uid);

    return this.getParticipantDocumentRealtime(eventId, uid).pipe(
      map(doc => {
        const isParticipating = !!doc;
        console.log('👤 isParticipating:', isParticipating);
        return isParticipating;
      })
    );
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Vérifie si un utilisateur peut rejoindre un événement (TEMPS RÉEL CONTINU)
   * 
   * Cette version reste en écoute continue et réémet à chaque changement.
   * À utiliser dans l'UI pour afficher l'état du bouton "Participer" en temps réel.
   * 
   * ⚡ RÉACTIVE : Réémet automatiquement quand :
   *    - L'utilisateur rejoint/quitte l'événement
   *    - Le nombre de participants change
   * 
   * @param event - Objet Event complet
   * @returns Observable qui émet { allowed: boolean, reason?: string } en continu
   */
  canJoinEventReactive(event: Event): Observable<{ allowed: boolean; reason?: string }> {
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      return of({ allowed: false, reason: 'Vous devez être connecté' });
    }

    // Vérification 1 : L'utilisateur est l'organisateur
    if (event.organizerId === userId) {
      return of({ allowed: false, reason: 'Vous êtes l\'organisateur de cet événement' });
    }

    console.log('🔍 canJoinEventReactive (TEMPS RÉEL) pour eventId:', event.id);

    // ✅ Combine les Observables temps réel SANS take(1)
    // Cela permet de réémettre à chaque changement
    return combineLatest([
      this.isUserParticipating(event.id!),
      this.getParticipantCount(event.id!)
    ]).pipe(
      map(([isParticipating, count]) => {
        console.log(`🔍 canJoinEventReactive: isParticipating=${isParticipating}, count=${count}/${event.maxParticipants}`);
        
        // Vérification 2 : L'utilisateur participe déjà
        if (isParticipating) {
          return { allowed: false, reason: 'Vous participez déjà à cet événement' };
        }

        // Vérification 3 : L'événement est complet
        if (count >= event.maxParticipants) {
          return { allowed: false, reason: 'L\'événement est complet' };
        }

        return { allowed: true };
      })
    );
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Vérifie si un utilisateur peut rejoindre un événement (ONE-TIME)
   * 
   * Cette version effectue une vérification ponctuelle unique.
   * À utiliser dans joinEvent() pour vérifier avant d'ajouter le participant.
   * 
   * ⏱️ PONCTUELLE : Émet une seule fois puis se termine
   * 
   * @param event - Objet Event complet
   * @returns Observable qui émet { allowed: boolean, reason?: string } une seule fois
   */
  canJoinEventOneTime(event: Event): Observable<{ allowed: boolean; reason?: string }> {
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      return of({ allowed: false, reason: 'Vous devez être connecté' });
    }

    // Vérification 1 : L'utilisateur est l'organisateur
    if (event.organizerId === userId) {
      return of({ allowed: false, reason: 'Vous êtes l\'organisateur de cet événement' });
    }

    console.log('🔍 canJoinEventOneTime (PONCTUEL) pour eventId:', event.id);

    // Vérification 2 : L'utilisateur participe déjà
    return this.isUserParticipating(event.id!).pipe(
      take(1), // ✅ take(1) OK ici car c'est une vérification ponctuelle avant action
      switchMap(isParticipating => {
        if (isParticipating) {
          return of({ allowed: false, reason: 'Vous participez déjà à cet événement' });
        }

        // Vérification 3 : L'événement est complet
        return this.getParticipantCount(event.id!).pipe(
          take(1), // ✅ take(1) OK ici car c'est une vérification ponctuelle
          map(count => {
            console.log(`🔍 canJoinEventOneTime: ${count} / ${event.maxParticipants} participants`);
            if (count >= event.maxParticipants) {
              return { allowed: false, reason: 'L\'événement est complet' };
            }

            return { allowed: true };
          })
        );
      })
    );
  }

  /**
   * @deprecated Utiliser canJoinEventReactive() pour l'affichage temps réel
   *             ou canJoinEventOneTime() pour les vérifications ponctuelles
   * 
   * Cette méthode redirige vers canJoinEventOneTime() par défaut
   */
  canJoinEventObservable(event: Event): Observable<{ allowed: boolean; reason?: string }> {
    console.warn('⚠️ canJoinEventObservable est deprecated, utilisez canJoinEventReactive() ou canJoinEventOneTime()');
    return this.canJoinEventOneTime(event);
  }

  /**
   * Vérifie de manière synchrone si un événement est complet
   * Méthode utilitaire pour les vérifications simples
   * 
   * @param currentParticipants - Nombre actuel de participants
   * @param maxParticipants - Nombre maximum autorisé
   * @returns true si l'événement est complet
   */
  isEventFull(currentParticipants: number, maxParticipants: number): boolean {
    return currentParticipants >= maxParticipants;
  }

  // ========================================
  // 📈 STATISTIQUES
  // ========================================

  /**
   * Compte le nombre de participants approuvés (TEMPS RÉEL)
   * 
   * @param eventId - ID de l'événement
   * @returns Observable<number> qui émet le nombre de participants
   */
  getParticipantCount(eventId: string): Observable<number> {
    return this.getParticipants(eventId).pipe(
      map(participants => {
        const count = participants.length;
        console.log(`📊 getParticipantCount: ${count} participants`);
        return count;
      })
    );
  }

  /**
   * Récupère les statistiques complètes de participation (TEMPS RÉEL)
   * 
   * @param eventId - ID de l'événement
   * @param maxParticipants - Limite maximum
   * @returns Observable<ParticipationStats> avec toutes les stats
   */
  getParticipationStats(eventId: string, maxParticipants: number): Observable<ParticipationStats> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(participantsRef, where('eventId', '==', eventId));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => doc.data() as Participant);
        
        const approvedCount = participants.filter(p => p.status === ParticipantStatus.APPROVED).length;
        const pendingCount = participants.filter(p => p.status === ParticipantStatus.PENDING).length;

        const stats: ParticipationStats = {
          eventId,
          totalParticipants: participants.length,
          approvedCount,
          pendingCount,
          maxParticipants,
          isFull: approvedCount >= maxParticipants
        };

        console.log(`📊 Stats pour ${eventId}:`, stats);
        observer.next(stats);
      }, (error) => {
        console.error('❌ Erreur getParticipationStats:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // 👨‍💼 GESTION ORGANISATEUR
  // ========================================

  /**
   * Permet à l'organisateur de retirer un participant
   * 
   * @param participantId - ID du document participant à supprimer
   * @returns Observable<void>
   */
  removeParticipant(participantId: string): Observable<void> {
    console.log('🗑️ removeParticipant:', participantId);
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    return from(deleteDoc(participantRef));
  }

  /**
   * Approuve une participation en attente
   * 
   * @param participantId - ID du document participant
   * @returns Observable<void>
   */
  approveParticipant(participantId: string): Observable<void> {
    console.log('✅ approveParticipant:', participantId);
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    return from(
      import('@angular/fire/firestore').then(({ updateDoc }) =>
        updateDoc(participantRef, { status: ParticipantStatus.APPROVED })
      )
    );
  }

  /**
   * Rejette une participation en attente
   * 
   * @param participantId - ID du document participant
   * @returns Observable<void>
   */
  rejectParticipant(participantId: string): Observable<void> {
    console.log('❌ rejectParticipant:', participantId);
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    return from(
      import('@angular/fire/firestore').then(({ updateDoc }) =>
        updateDoc(participantRef, { status: ParticipantStatus.REJECTED })
      )
    );
  }

  // ========================================
  // 🔧 MÉTHODES UTILITAIRES PRIVÉES
  // ========================================

  /**
   * ⚡ Récupère le document participant en TEMPS RÉEL
   * 
   * Utilisée par isUserParticipating() pour avoir la réactivité continue.
   * Écoute en continu les changements dans Firestore avec onSnapshot.
   * 
   * @param eventId - ID de l'événement
   * @param userId - ID de l'utilisateur
   * @returns Observable<Participant | null> qui émet à chaque changement
   */
  private getParticipantDocumentRealtime(eventId: string, userId: string): Observable<Participant | null> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef,
        where('eventId', '==', eventId),
        where('userId', '==', userId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          console.log('🔍 getParticipantDocumentRealtime: aucun document trouvé');
          observer.next(null);
        } else {
          const doc = snapshot.docs[0];
          const participant = { id: doc.id, ...doc.data() } as Participant;
          console.log('🔍 getParticipantDocumentRealtime: document trouvé', participant.id);
          observer.next(participant);
        }
      }, (error) => {
        console.error('❌ Erreur getParticipantDocumentRealtime:', error);
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * ⏱️ Récupère le document participant ONE-TIME
   * 
   * Utilisée pour joinEvent() et leaveEvent() où on veut juste une vérification ponctuelle.
   * Effectue une requête unique avec getDocs (pas de réactivité).
   * 
   * @param eventId - ID de l'événement
   * @param userId - ID de l'utilisateur
   * @returns Observable<Participant | null> qui émet une seule fois
   */
  private getParticipantDocumentOneTime(eventId: string, userId: string): Observable<Participant | null> {
    const participantsRef = collection(this.firestore, this.participantsCollection);
    const q = query(
      participantsRef,
      where('eventId', '==', eventId),
      where('userId', '==', userId)
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        if (snapshot.empty) {
          console.log('🔍 getParticipantDocumentOneTime: aucun document trouvé');
          return null;
        }
        const doc = snapshot.docs[0];
        const participant = { id: doc.id, ...doc.data() } as Participant;
        console.log('🔍 getParticipantDocumentOneTime: document trouvé', participant.id);
        return participant;
      })
    );
  }
}

// ========================================
// 📚 GUIDE D'UTILISATION
// ========================================

/*
QUAND UTILISER QUELLE MÉTHODE ?

1. AFFICHAGE TEMPS RÉEL (UI réactive) ⚡
   → canJoinEventReactive()
   → isUserParticipating()
   → getParticipantCount()
   → getParticipants()
   → getParticipationsByUser()
   
   Ces méthodes restent en écoute continue et mettent à jour l'UI automatiquement.

2. ACTIONS PONCTUELLES (vérifications avant action) ⏱️
   → canJoinEventOneTime()
   → getParticipantDocumentOneTime()
   
   Ces méthodes effectuent une vérification unique puis se terminent.

EXEMPLES :

// ✅ BIEN : Pour afficher le bouton "Participer" en temps réel
this.participantsService.canJoinEventReactive(event).subscribe(result => {
  this.canJoin = result.allowed;
  this.canJoinReason = result.reason || '';
});

// ✅ BIEN : Pour vérifier avant d'ajouter un participant
this.participantsService.canJoinEventOneTime(event).pipe(
  take(1) // Optionnel car déjà ponctuel
).subscribe(result => {
  if (result.allowed) {
    // Ajouter le participant
  }
});

// ❌ MAL : Ne pas utiliser take(1) sur une méthode réactive
this.participantsService.canJoinEventReactive(event).pipe(
  take(1) // ❌ Coupe la réactivité !
).subscribe(/* ... */