// src/app/core/services/events.service.ts
// Service de gestion des événements
// ✅ MODIFIÉ Sprint 4 : Récupération photo de profil depuis Firestore

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable, from, map, switchMap } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { UsersService } from './users.service'; // ✅ AJOUTÉ
import { Event, CreateEventDto, EventCategory } from '../models/event.model';
import { Participant, ParticipantStatus } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  // Injection des services
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  private readonly usersService = inject(UsersService); // ✅ AJOUTÉ
  
  // Noms des collections Firestore
  private readonly eventsCollection = 'events';
  private readonly participantsCollection = 'participants';

  constructor() {}

  // ========================================
  // CRÉATION D'ÉVÉNEMENTS
  // ========================================

  /**
   * Crée un nouvel événement dans Firestore
   * ✅ MODIFIÉ : Récupère la photo de profil depuis Firestore
   * 
   * @param eventData Données de l'événement à créer
   * @returns Observable avec l'ID du document créé
   */
  createEvent(eventData: CreateEventDto): Observable<string> {
    const userId = this.authService.getCurrentUserId();
    const userEmail = this.authService.getCurrentUserEmail();
    const userName = this.authService.getCurrentUserDisplayName();

    if (!userId) {
      throw new Error('Utilisateur non connecté');
    }

    // ✅ MODIFIÉ : Récupère le profil utilisateur pour obtenir la photo
    return this.usersService.getUserProfileOnce(userId).pipe(
      switchMap(userProfile => {
        // Utilise la photo du profil si disponible
        const organizerPhoto = userProfile?.photoURL || '';
        
        console.log('📸 Photo organisateur:', organizerPhoto);

        // Prépare les données pour Firestore
        const eventToCreate: Omit<Event, 'id'> = {
          title: eventData.title,
          description: eventData.description,
          date: Timestamp.fromDate(eventData.date),
          location: eventData.location,
          organizerId: userId,
          organizerName: userName || userEmail || 'Organisateur',
          organizerPhoto: organizerPhoto, // ✅ MODIFIÉ : Photo du profil
          maxParticipants: eventData.maxParticipants,
          category: eventData.category,
          imageUrl: eventData.imageUrl || '',
          images: [],
          isPrivate: eventData.isPrivate,
          requiresApproval: eventData.requiresApproval,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          tags: eventData.tags || []
        };

        const eventsRef = collection(this.firestore, this.eventsCollection);
        
        // Crée l'événement PUIS ajoute l'organisateur comme participant
        return from(addDoc(eventsRef, eventToCreate)).pipe(
          switchMap(docRef => {
            const eventId = docRef.id;
            console.log('✅ Événement créé:', eventId);

            // Crée le document participant pour l'organisateur
            const participantData: Omit<Participant, 'id'> = {
              eventId,
              userId,
              userName: userName || userEmail || 'Organisateur',
              userEmail: userEmail || '',
              userPhoto: organizerPhoto, // ✅ MODIFIÉ : Photo du profil
              joinedAt: Timestamp.now(),
              status: ParticipantStatus.APPROVED
            };

            const participantsRef = collection(this.firestore, this.participantsCollection);
            
            return from(addDoc(participantsRef, participantData)).pipe(
              map(() => {
                console.log('✅ Organisateur ajouté comme participant');
                return eventId;
              })
            );
          })
        );
      })
    );
  }

  // ========================================
  // LECTURE D'ÉVÉNEMENTS
  // ========================================

  /**
   * Récupère tous les événements (temps réel)
   * @returns Observable<Event[]>
   */
  getAllEvents(): Observable<Event[]> {
    return new Observable(observer => {
      const eventsRef = collection(this.firestore, this.eventsCollection);
      const q = query(eventsRef, orderBy('date', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Event));
        
        console.log(`📋 ${events.length} événements récupérés`);
        observer.next(events);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère les événements à venir
   * @returns Observable<Event[]>
   */
  getUpcomingEvents(): Observable<Event[]> {
    return new Observable(observer => {
      const eventsRef = collection(this.firestore, this.eventsCollection);
      const now = Timestamp.now();
      const q = query(
        eventsRef,
        where('date', '>=', now),
        orderBy('date', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Event));
        
        observer.next(events);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère un événement par son ID (temps réel)
   * @param eventId ID de l'événement
   * @returns Observable<Event | null>
   */
  getEventById(eventId: string): Observable<Event | null> {
    return new Observable(observer => {
      const eventDocRef = doc(this.firestore, this.eventsCollection, eventId);

      const unsubscribe = onSnapshot(eventDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const event: Event = {
            id: snapshot.id,
            ...snapshot.data()
          } as Event;
          
          observer.next(event);
        } else {
          observer.next(null);
        }
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère les événements créés par un utilisateur
   * @param organizerId ID de l'organisateur
   * @returns Observable<Event[]>
   */
  getEventsByOrganizer(organizerId: string): Observable<Event[]> {
    return new Observable(observer => {
      const eventsRef = collection(this.firestore, this.eventsCollection);
      const q = query(
        eventsRef,
        where('organizerId', '==', organizerId),
        orderBy('date', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Event));
        
        observer.next(events);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // MODIFICATION D'ÉVÉNEMENTS
  // ========================================

  /**
   * Met à jour un événement
   * @param eventId ID de l'événement
   * @param updates Données à mettre à jour
   * @returns Observable<void>
   */
  updateEvent(eventId: string, updates: Partial<Event>): Observable<void> {
    const eventDocRef = doc(this.firestore, this.eventsCollection, eventId);

    const dataToUpdate = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    return from(updateDoc(eventDocRef, dataToUpdate)).pipe(
      map(() => {
        console.log('✅ Événement mis à jour:', eventId);
      })
    );
  }

  // ========================================
  // SUPPRESSION D'ÉVÉNEMENTS
  // ========================================

  /**
   * Supprime un événement
   * @param eventId ID de l'événement
   * @returns Observable<void>
   */
  deleteEvent(eventId: string): Observable<void> {
    const eventDocRef = doc(this.firestore, this.eventsCollection, eventId);

    return from(deleteDoc(eventDocRef)).pipe(
      map(() => {
        console.log('✅ Événement supprimé:', eventId);
      })
    );
  }

  // ========================================
  // RECHERCHE ET FILTRES
  // ========================================

  /**
   * Recherche des événements par titre ou description
   * @param searchTerm Terme de recherche
   * @returns Observable<Event[]>
   */
  searchEvents(searchTerm: string): Observable<Event[]> {
    return this.getAllEvents().pipe(
      map(events => {
        const term = searchTerm.toLowerCase();
        return events.filter(event =>
          event.title.toLowerCase().includes(term) ||
          event.description.toLowerCase().includes(term)
        );
      })
    );
  }

  /**
   * Filtre les événements par catégorie
   * @param category Catégorie à filtrer
   * @returns Observable<Event[]>
   */
  filterEventsByCategory(category: EventCategory): Observable<Event[]> {
    return this.getAllEvents().pipe(
      map(events => events.filter(event => event.category === category))
    );
  }
}