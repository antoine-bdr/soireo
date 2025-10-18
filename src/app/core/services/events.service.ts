// src/app/core/services/events.service.ts
// Service de gestion des événements - VERSION CORRIGÉE SPRINT 3

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
  onSnapshot,
  getDoc
} from '@angular/fire/firestore';
import { Observable, from, map, switchMap } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { Event, CreateEventDto, EventCategory } from '../models/event.model';
import { Participant, ParticipantStatus } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  // Injection des services
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  
  // Noms des collections Firestore
  private readonly eventsCollection = 'events';
  private readonly participantsCollection = 'participants';

  constructor() {}

  // ========================================
  // CRÉATION D'ÉVÉNEMENTS
  // ========================================

  /**
   * Crée un nouvel événement dans Firestore
   * 🆕 AJOUT : Ajoute automatiquement l'organisateur comme premier participant
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

    // Prépare les données pour Firestore
    const eventToCreate: Omit<Event, 'id'> = {
      title: eventData.title,
      description: eventData.description,
      date: Timestamp.fromDate(eventData.date),
      location: eventData.location,
      organizerId: userId,
      organizerName: userName || userEmail || 'Organisateur',
      organizerPhoto: '',
      maxParticipants: eventData.maxParticipants,
      currentParticipants: 0, // 🔧 FIX : Commence à 0, sera incrémenté après
      participants: [], // 🔧 FIX : Vide au début
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
    
    // 🆕 AJOUT : Créer l'événement PUIS ajouter l'organisateur comme participant
    return from(addDoc(eventsRef, eventToCreate)).pipe(
      switchMap(docRef => {
        const eventId = docRef.id;
        console.log('✅ Événement créé:', eventId);

        // Créer le document participant pour l'organisateur
        const participantData: Omit<Participant, 'id'> = {
          eventId,
          userId,
          userName: userName || userEmail || 'Organisateur',
          userEmail: userEmail || '',
          userPhoto: '',
          joinedAt: Timestamp.now(),
          status: ParticipantStatus.APPROVED // Organisateur toujours approuvé
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
        })) as Event[];
        
        observer.next(events);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère uniquement les événements à venir
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
        })) as Event[];
        
        observer.next(events);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère un événement par son ID
   * @param eventId ID de l'événement
   * @returns Observable<Event | null>
   */
  getEventById(eventId: string): Observable<Event | null> {
    return new Observable(observer => {
      const eventRef = doc(this.firestore, this.eventsCollection, eventId);

      const unsubscribe = onSnapshot(eventRef, (snapshot) => {
        if (!snapshot.exists()) {
          observer.next(null);
          return;
        }

        const event = {
          id: snapshot.id,
          ...snapshot.data()
        } as Event;

        observer.next(event);
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  /**
   * Récupère les événements créés par un utilisateur
   * @param userId ID de l'utilisateur
   * @returns Observable<Event[]>
   */
  getEventsByOrganizer(userId: string): Observable<Event[]> {
    return new Observable(observer => {
      const eventsRef = collection(this.firestore, this.eventsCollection);
      const q = query(
        eventsRef,
        where('organizerId', '==', userId),
        orderBy('date', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Event[];
        
        observer.next(events);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // RECHERCHE ET FILTRAGE
  // ========================================

  /**
   * Recherche des événements par titre ou description
   * @param searchTerm Terme de recherche
   * @returns Observable<Event[]>
   */
  searchEvents(searchTerm: string): Observable<Event[]> {
    return this.getAllEvents().pipe(
      map(events => 
        events.filter(event =>
          event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    );
  }

  /**
   * Filtre les événements par catégorie
   * @param category Catégorie à filtrer
   * @returns Observable<Event[]>
   */
  filterEventsByCategory(category: EventCategory): Observable<Event[]> {
    return new Observable(observer => {
      const eventsRef = collection(this.firestore, this.eventsCollection);
      const q = query(
        eventsRef,
        where('category', '==', category),
        orderBy('date', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Event[];
        
        observer.next(events);
      });

      return () => unsubscribe();
    });
  }

  // ========================================
  // MISE À JOUR ET SUPPRESSION
  // ========================================

  /**
   * Met à jour un événement existant
   * @param eventId ID de l'événement
   * @param updates Champs à mettre à jour
   * @returns Observable<void>
   */
  updateEvent(eventId: string, updates: Partial<Event>): Observable<void> {
    const eventRef = doc(this.firestore, this.eventsCollection, eventId);
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    return from(updateDoc(eventRef, updatedData));
  }

  /**
   * Supprime un événement
   * @param eventId ID de l'événement
   * @returns Observable<void>
   */
  deleteEvent(eventId: string): Observable<void> {
    const eventRef = doc(this.firestore, this.eventsCollection, eventId);
    return from(deleteDoc(eventRef));
  }

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Retourne le label de la catégorie avec emoji
   */
  getCategoryLabel(category: EventCategory): string {
    const labels: Record<EventCategory, string> = {
      [EventCategory.PARTY]: '🎉 Soirée',
      [EventCategory.CONCERT]: '🎵 Concert',
      [EventCategory.FESTIVAL]: '🎪 Festival',
      [EventCategory.BAR]: '🍺 Bar',
      [EventCategory.CLUB]: '💃 Club',
      [EventCategory.OUTDOOR]: '🌳 Extérieur',
      [EventCategory.PRIVATE]: '🔒 Privé',
      [EventCategory.OTHER]: '📌 Autre'
    };
    return labels[category] || category;
  }

  /**
   * Retourne la couleur de la catégorie
   */
  getCategoryColor(category: EventCategory): string {
    const colors: Record<EventCategory, string> = {
      [EventCategory.PARTY]: 'primary',
      [EventCategory.CONCERT]: 'secondary',
      [EventCategory.FESTIVAL]: 'tertiary',
      [EventCategory.BAR]: 'warning',
      [EventCategory.CLUB]: 'danger',
      [EventCategory.OUTDOOR]: 'success',
      [EventCategory.PRIVATE]: 'medium',
      [EventCategory.OTHER]: 'dark'
    };
    return colors[category] || 'medium';
  }

  /**
   * Vérifie si un événement est complet
   */
  isEventFull(event: Event): boolean {
    return event.currentParticipants >= event.maxParticipants;
  }
}