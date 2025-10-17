// src/app/core/services/events.service.ts
// Service de gestion des événements avec Firestore

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint
} from '@angular/fire/firestore';
import { Observable, from, map, switchMap } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { Event, CreateEventDto, EventCategory } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  // Injection des services
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  
  // Nom de la collection Firestore
  private readonly eventsCollection = 'events';

  constructor() {}

  // ========================================
  // CRÉATION D'ÉVÉNEMENTS
  // ========================================

  /**
   * Crée un nouvel événement dans Firestore
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
      organizerPhoto: '', // TODO: Ajouter la photo de profil plus tard
      maxParticipants: eventData.maxParticipants,
      currentParticipants: 1, // L'organisateur est le premier participant
      participants: [userId], // L'organisateur rejoint automatiquement
      category: eventData.category,
      imageUrl: eventData.imageUrl || '',
      images: [],
      isPrivate: eventData.isPrivate,
      requiresApproval: eventData.requiresApproval,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      tags: eventData.tags || []
    };

    // Ajoute le document à Firestore
    const eventsRef = collection(this.firestore, this.eventsCollection);
    return from(addDoc(eventsRef, eventToCreate)).pipe(
      map(docRef => {
        console.log('✅ Événement créé avec ID:', docRef.id);
        return docRef.id;
      })
    );
  }

  // ========================================
  // LECTURE D'ÉVÉNEMENTS
  // ========================================

  /**
   * Récupère tous les événements publics (écoute en temps réel)
   * @returns Observable avec la liste des événements
   */
  getAllEvents(): Observable<Event[]> {
    const eventsRef = collection(this.firestore, this.eventsCollection);
    
    // Query : événements publics, triés par date (plus récents en premier)
    const q = query(
      eventsRef,
      where('isPrivate', '==', false),
      orderBy('date', 'desc')
    );

    // collectionData écoute les changements en temps réel
    return collectionData(q, { idField: 'id' }).pipe(
      map(events => events as Event[]),
      map(events => {
        console.log(`📋 ${events.length} événements chargés`);
        return events;
      })
    );
  }

  /**
   * Récupère les événements à venir (date future uniquement)
   * @returns Observable avec les événements futurs
   */
  getUpcomingEvents(): Observable<Event[]> {
    const eventsRef = collection(this.firestore, this.eventsCollection);
    const now = Timestamp.now();
    
    const q = query(
      eventsRef,
      where('isPrivate', '==', false),
      where('date', '>=', now),
      orderBy('date', 'asc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(events => events as Event[])
    );
  }

  /**
   * Récupère un événement par son ID
   * @param eventId ID de l'événement
   * @returns Observable avec l'événement
   */
  getEventById(eventId: string): Observable<Event | null> {
    const eventDocRef = doc(this.firestore, `${this.eventsCollection}/${eventId}`);
    
    return docData(eventDocRef, { idField: 'id' }).pipe(
      map(event => {
        if (event) {
          console.log('📄 Événement chargé:', event['id']);
          return event as Event;
        }
        return null;
      })
    );
  }

  /**
   * Récupère les événements organisés par un utilisateur
   * @param userId ID de l'utilisateur
   * @returns Observable avec les événements de l'utilisateur
   */
  getEventsByOrganizer(userId: string): Observable<Event[]> {
    const eventsRef = collection(this.firestore, this.eventsCollection);
    
    const q = query(
      eventsRef,
      where('organizerId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(events => events as Event[])
    );
  }

  /**
   * Récupère les événements auxquels un utilisateur participe
   * @param userId ID de l'utilisateur
   * @returns Observable avec les événements
   */
  getEventsJoinedByUser(userId: string): Observable<Event[]> {
    const eventsRef = collection(this.firestore, this.eventsCollection);
    
    const q = query(
      eventsRef,
      where('participants', 'array-contains', userId),
      orderBy('date', 'asc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(events => events as Event[])
    );
  }

  /**
   * Recherche d'événements par titre
   * @param searchTerm Terme de recherche
   * @returns Observable avec les résultats
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

  // ========================================
  // MODIFICATION D'ÉVÉNEMENTS
  // ========================================

  /**
   * Met à jour un événement existant
   * @param eventId ID de l'événement
   * @param updates Données à mettre à jour
   * @returns Observable de la mise à jour
   */
  updateEvent(eventId: string, updates: Partial<Event>): Observable<void> {
    const eventDocRef = doc(this.firestore, `${this.eventsCollection}/${eventId}`);
    
    // Ajoute la date de mise à jour
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
   * @param eventId ID de l'événement à supprimer
   * @returns Observable de la suppression
   */
  deleteEvent(eventId: string): Observable<void> {
    const eventDocRef = doc(this.firestore, `${this.eventsCollection}/${eventId}`);
    
    return from(deleteDoc(eventDocRef)).pipe(
      map(() => {
        console.log('🗑️ Événement supprimé:', eventId);
      })
    );
  }

  // ========================================
  // GESTION DES PARTICIPANTS
  // ========================================

  /**
   * Ajoute un utilisateur aux participants d'un événement
   * @param eventId ID de l'événement
   * @param userId ID de l'utilisateur
   * @returns Observable de l'ajout
   */
  joinEvent(eventId: string, userId: string): Observable<void> {
    return this.getEventById(eventId).pipe(
      switchMap(event => {
        if (!event) {
          throw new Error('Événement introuvable');
        }

        // Vérifie si l'utilisateur n'est pas déjà participant
        if (event.participants.includes(userId)) {
          throw new Error('Tu participes déjà à cet événement');
        }

        // Vérifie le nombre maximum de participants
        if (event.currentParticipants >= event.maxParticipants) {
          throw new Error('Événement complet');
        }

        // Met à jour l'événement
        const eventDocRef = doc(this.firestore, `${this.eventsCollection}/${eventId}`);
        return from(updateDoc(eventDocRef, {
          participants: [...event.participants, userId],
          currentParticipants: event.currentParticipants + 1,
          updatedAt: Timestamp.now()
        }));
      })
    );
  }

  /**
   * Retire un utilisateur des participants d'un événement
   * @param eventId ID de l'événement
   * @param userId ID de l'utilisateur
   * @returns Observable du retrait
   */
  leaveEvent(eventId: string, userId: string): Observable<void> {
    return this.getEventById(eventId).pipe(
      switchMap(event => {
        if (!event) {
          throw new Error('Événement introuvable');
        }

        // Vérifie que l'utilisateur est bien participant
        if (!event.participants.includes(userId)) {
          throw new Error('Tu ne participes pas à cet événement');
        }

        // L'organisateur ne peut pas quitter son propre événement
        if (event.organizerId === userId) {
          throw new Error('L\'organisateur ne peut pas quitter son événement');
        }

        // Met à jour l'événement
        const eventDocRef = doc(this.firestore, `${this.eventsCollection}/${eventId}`);
        const updatedParticipants = event.participants.filter(id => id !== userId);
        
        return from(updateDoc(eventDocRef, {
          participants: updatedParticipants,
          currentParticipants: event.currentParticipants - 1,
          updatedAt: Timestamp.now()
        }));
      })
    );
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  /**
   * Vérifie si l'utilisateur connecté est l'organisateur d'un événement
   * @param event L'événement à vérifier
   * @returns true si organisateur, false sinon
   */
  isOrganizer(event: Event): boolean {
    const currentUserId = this.authService.getCurrentUserId();
    return event.organizerId === currentUserId;
  }

  /**
   * Vérifie si l'utilisateur connecté participe à un événement
   * @param event L'événement à vérifier
   * @returns true si participant, false sinon
   */
  isParticipant(event: Event): boolean {
    const currentUserId = this.authService.getCurrentUserId();
    return event.participants.includes(currentUserId || '');
  }
}