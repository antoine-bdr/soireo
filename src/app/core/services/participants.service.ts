// src/app/core/services/participants.service.ts
// Service de gestion des participations aux événements

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
  Timestamp,
  writeBatch
} from '@angular/fire/firestore';
import { Observable, from, map, switchMap, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { 
  Participant, 
  CreateParticipantDto, 
  ParticipantStatus,
  ParticipationStats 
} from '../models/participant.model';
import { Event } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class ParticipantsService {
  // Injection des services
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  
  // Nom de la collection Firestore
  private readonly participantsCollection = 'participants';

  constructor() {}

  // ========================================
  // REJOINDRE UN ÉVÉNEMENT
  // ========================================

  /**
   * Permet à un utilisateur de rejoindre un événement
   * 🔧 FIX : Utilise take(1) pour éviter les boucles infinies
   * @param eventId ID de l'événement
   * @param event Objet Event complet (pour vérifications)
   * @returns Observable<void>
   */
  joinEvent(eventId: string, event: Event): Observable<void> {
    const userId = this.authService.getCurrentUserId();
    const userName = this.authService.getCurrentUserDisplayName();
    const userEmail = this.authService.getCurrentUserEmail();

    if (!userId || !userEmail) {
      throw new Error('Utilisateur non connecté');
    }

    console.log('🔵 joinEvent appelé pour eventId:', eventId, 'userId:', userId);

    // 🔧 FIX : take(1) pour garantir qu'on ne vérifie qu'UNE SEULE FOIS
    return this.getParticipantDocument(eventId, userId).pipe(
      take(1), // ← CORRECTION : Ne prend que la première émission
      switchMap(existingParticipant => {
        // Si déjà participant, on arrête tout de suite
        if (existingParticipant) {
          console.log('⚠️ L\'utilisateur participe déjà');
          throw new Error('Vous participez déjà à cet événement');
        }

        console.log('✅ L\'utilisateur ne participe pas encore, vérification suivante...');

        // Vérifications préalables
        return this.canJoinEventObservable(event).pipe(
          take(1), // ← CORRECTION : Ne prend que la première émission
          switchMap(canJoin => {
            if (!canJoin.allowed) {
              console.log('⚠️ Impossible de rejoindre:', canJoin.reason);
              throw new Error(canJoin.reason || 'Impossible de rejoindre cet événement');
            }

            console.log('✅ Vérifications passées, création du participant...');

            // Crée le document participant
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
  // QUITTER UN ÉVÉNEMENT
  // ========================================

  /**
   * Permet à un utilisateur de quitter un événement
   * @param eventId ID de l'événement
   * @returns Observable<void>
   */
  leaveEvent(eventId: string): Observable<void> {
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      throw new Error('Utilisateur non connecté');
    }

    // Trouve le document de participation
    return this.getParticipantDocument(eventId, userId).pipe(
      switchMap(participantDoc => {
        if (!participantDoc) {
          throw new Error('Vous ne participez pas à cet événement');
        }

        const participantRef = doc(this.firestore, this.participantsCollection, participantDoc.id!);
        return from(deleteDoc(participantRef));
      })
    );
  }

  // ========================================
  // RÉCUPÉRATION DES PARTICIPANTS
  // ========================================

  /**
   * Récupère tous les participants d'un événement (temps réel)
   * @param eventId ID de l'événement
   * @returns Observable<Participant[]>
   */
  getParticipants(eventId: string): Observable<Participant[]> {
    return new Observable(observer => {
      const participantsRef = collection(this.firestore, this.participantsCollection);
      const q = query(
        participantsRef, 
        where('eventId', '==', eventId),
        where('status', '==', ParticipantStatus.APPROVED), // Seulement les approuvés
        orderBy('joinedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Participant[];
        
        observer.next(participants);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère tous les événements auxquels un utilisateur participe
   * @param userId ID de l'utilisateur
   * @returns Observable<Participant[]>
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
        
        observer.next(participations);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère les participations en attente d'approbation pour un événement
   * @param eventId ID de l'événement
   * @returns Observable<Participant[]>
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
        
        observer.next(pending);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // VÉRIFICATIONS
  // ========================================

  /**
   * Vérifie si un utilisateur participe déjà à un événement
   * @param eventId ID de l'événement
   * @param userId ID de l'utilisateur (optionnel, prend user connecté par défaut)
   * @returns Observable<boolean>
   */
  isUserParticipating(eventId: string, userId?: string): Observable<boolean> {
    const uid = userId || this.authService.getCurrentUserId();
    
    if (!uid) {
      return of(false);
    }

    return this.getParticipantDocument(eventId, uid).pipe(
      map(doc => !!doc)
    );
  }

  /**
   * Vérifie si un utilisateur peut rejoindre un événement
   * 🔧 FIX : Utilise take(1) pour éviter les boucles infinies
   * @param event Objet Event complet
   * @returns Observable avec résultat { allowed: boolean, reason?: string }
   */
  canJoinEventObservable(event: Event): Observable<{ allowed: boolean; reason?: string }> {
    const userId = this.authService.getCurrentUserId();

    if (!userId) {
      return of({ allowed: false, reason: 'Vous devez être connecté' });
    }

    // Vérification 1 : L'utilisateur est l'organisateur
    if (event.organizerId === userId) {
      return of({ allowed: false, reason: 'Vous êtes l\'organisateur de cet événement' });
    }

    // Vérification 2 : L'utilisateur participe déjà
    return this.isUserParticipating(event.id!).pipe(
      switchMap(isParticipating => {
        if (isParticipating) {
          return of({ allowed: false, reason: 'Vous participez déjà à cet événement' });
        }

        // Vérification 3 : L'événement est complet
        // 🔧 FIX CRITIQUE : take(1) pour éviter la boucle infinie
        return this.getParticipantCount(event.id!).pipe(
          take(1), // ← CORRECTION : Ne prend que la première émission
          map(count => {
            console.log(`🔍 Vérification : ${count} / ${event.maxParticipants} participants`);
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
   * Vérifie de manière synchrone si un événement est complet
   * @param currentParticipants Nombre actuel de participants
   * @param maxParticipants Nombre maximum
   * @returns boolean
   */
  isEventFull(currentParticipants: number, maxParticipants: number): boolean {
    return currentParticipants >= maxParticipants;
  }

  // ========================================
  // STATISTIQUES
  // ========================================

  /**
   * Compte le nombre de participants approuvés d'un événement
   * @param eventId ID de l'événement
   * @returns Observable<number>
   */
  getParticipantCount(eventId: string): Observable<number> {
    return this.getParticipants(eventId).pipe(
      map(participants => participants.length)
    );
  }

  /**
   * Récupère les statistiques complètes de participation
   * @param eventId ID de l'événement
   * @param maxParticipants Limite maximum
   * @returns Observable<ParticipationStats>
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

        observer.next(stats);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // GESTION ORGANISATEUR
  // ========================================

  /**
   * Permet à l'organisateur de retirer un participant
   * @param participantId ID du document participant
   * @returns Observable<void>
   */
  removeParticipant(participantId: string): Observable<void> {
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    return from(deleteDoc(participantRef));
  }

  /**
   * Approuve une participation en attente
   * @param participantId ID du document participant
   * @returns Observable<void>
   */
  approveParticipant(participantId: string): Observable<void> {
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    return from(
      import('@angular/fire/firestore').then(({ updateDoc }) =>
        updateDoc(participantRef, { status: ParticipantStatus.APPROVED })
      )
    );
  }

  /**
   * Rejette une participation en attente
   * @param participantId ID du document participant
   * @returns Observable<void>
   */
  rejectParticipant(participantId: string): Observable<void> {
    const participantRef = doc(this.firestore, this.participantsCollection, participantId);
    return from(
      import('@angular/fire/firestore').then(({ updateDoc }) =>
        updateDoc(participantRef, { status: ParticipantStatus.REJECTED })
      )
    );
  }

  // ========================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ========================================

  /**
   * Récupère le document de participation d'un utilisateur pour un événement
   * @param eventId ID de l'événement
   * @param userId ID de l'utilisateur
   * @returns Observable<Participant | null>
   */
  private getParticipantDocument(eventId: string, userId: string): Observable<Participant | null> {
    const participantsRef = collection(this.firestore, this.participantsCollection);
    const q = query(
      participantsRef,
      where('eventId', '==', eventId),
      where('userId', '==', userId)
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        if (snapshot.empty) {
          return null;
        }
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Participant;
      })
    );
  }
}