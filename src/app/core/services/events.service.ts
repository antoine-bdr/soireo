// events.service.ts - VERSION DEBUG
// ✅ Ajout de logs détaillés pour identifier le problème exact
// Remplacer temporairement votre fichier existant par celui-ci pour déboguer

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
import { UsersService } from './users.service';
import { Event, CreateEventDto, EventCategory } from '../models/event.model';
import { Participant, ParticipantStatus } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  private readonly usersService = inject(UsersService);
  
  private readonly eventsCollection = 'events';
  private readonly participantsCollection = 'participants';

  constructor() {}

  /**
   * Crée un nouvel événement dans Firestore
   * ✅ VERSION DEBUG avec logs détaillés
   */
  createEvent(eventData: CreateEventDto): Observable<string> {
    const userId = this.authService.getCurrentUserId();
    const userEmail = this.authService.getCurrentUserEmail();
    const userName = this.authService.getCurrentUserDisplayName();

    console.log('🔍 [DEBUG] Début createEvent');
    console.log('🔍 [DEBUG] userId:', userId);
    console.log('🔍 [DEBUG] userEmail:', userEmail);
    console.log('🔍 [DEBUG] userName:', userName);

    if (!userId) {
      throw new Error('Utilisateur non connecté');
    }

    return this.usersService.getUserProfileOnce(userId).pipe(
      switchMap(userProfile => {
        const organizerPhoto = userProfile?.photoURL || '';
        
        console.log('🔍 [DEBUG] organizerPhoto:', organizerPhoto);
        console.log('🔍 [DEBUG] eventData reçu:', JSON.stringify(eventData, null, 2));

        // ✅ Validation GPS AVANT création
        if (!eventData.location.latitude || !eventData.location.longitude) {
          console.error('❌ [DEBUG] ERREUR : Coordonnées GPS manquantes !', {
            latitude: eventData.location.latitude,
            longitude: eventData.location.longitude
          });
          throw new Error('Coordonnées GPS manquantes');
        }

        if (typeof eventData.location.latitude !== 'number' || typeof eventData.location.longitude !== 'number') {
          console.error('❌ [DEBUG] ERREUR : Coordonnées GPS ne sont pas des nombres !', {
            latitude: eventData.location.latitude,
            latitudeType: typeof eventData.location.latitude,
            longitude: eventData.location.longitude,
            longitudeType: typeof eventData.location.longitude
          });
          throw new Error('Coordonnées GPS invalides');
        }

        // Préparation des données
        const eventToCreate: Omit<Event, 'id'> = {
          title: eventData.title,
          description: eventData.description,
          date: Timestamp.fromDate(eventData.date),
          location: eventData.location,
          organizerId: userId,
          organizerName: userName || userEmail || 'Organisateur',
          organizerPhoto: organizerPhoto,
          maxParticipants: eventData.maxParticipants,
          currentParticipants: 1,
          participants: [userId],
          category: eventData.category,
          imageUrl: eventData.imageUrl || '',
          images: [],
          isPrivate: eventData.isPrivate,
          requiresApproval: eventData.requiresApproval,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          tags: eventData.tags || []
        };

        // ✅ LOGS DÉTAILLÉS AVANT ENVOI
        console.log('🔍 [DEBUG] ========================================');
        console.log('🔍 [DEBUG] DONNÉES À ENVOYER À FIRESTORE:');
        console.log('🔍 [DEBUG] ========================================');
        console.log(JSON.stringify(eventToCreate, null, 2));
        
        console.log('🔍 [DEBUG] ========================================');
        console.log('🔍 [DEBUG] VÉRIFICATION DES TYPES:');
        console.log('🔍 [DEBUG] ========================================');
        console.log({
          'title (string)': typeof eventToCreate.title,
          'description (string)': typeof eventToCreate.description,
          'date (timestamp)': eventToCreate.date instanceof Timestamp,
          'organizerId (string)': typeof eventToCreate.organizerId,
          'organizerName (string)': typeof eventToCreate.organizerName,
          'organizerPhoto (string)': typeof eventToCreate.organizerPhoto,
          'maxParticipants (number)': typeof eventToCreate.maxParticipants,
          'currentParticipants (number)': typeof eventToCreate.currentParticipants,
          'participants (array)': Array.isArray(eventToCreate.participants),
          'participants.length': eventToCreate.participants.length,
          'participants[0] (string)': typeof eventToCreate.participants[0],
          'category (string)': typeof eventToCreate.category,
          'imageUrl (string)': typeof eventToCreate.imageUrl,
          'images (array)': Array.isArray(eventToCreate.images),
          'tags (array)': Array.isArray(eventToCreate.tags),
          'isPrivate (boolean)': typeof eventToCreate.isPrivate,
          'requiresApproval (boolean)': typeof eventToCreate.requiresApproval,
          'createdAt (timestamp)': eventToCreate.createdAt instanceof Timestamp,
          'updatedAt (timestamp)': eventToCreate.updatedAt instanceof Timestamp,
          'location (object)': typeof eventToCreate.location,
          'location.address (string)': typeof eventToCreate.location.address,
          'location.city (string)': typeof eventToCreate.location.city,
          'location.zipCode (string)': typeof eventToCreate.location.zipCode,
          'location.latitude (number)': typeof eventToCreate.location.latitude,
          'location.longitude (number)': typeof eventToCreate.location.longitude,
        });

        console.log('🔍 [DEBUG] ========================================');
        console.log('🔍 [DEBUG] VALEURS DES CHAMPS CRITIQUES:');
        console.log('🔍 [DEBUG] ========================================');
        console.log({
          'currentParticipants': eventToCreate.currentParticipants,
          'participants': eventToCreate.participants,
          'maxParticipants': eventToCreate.maxParticipants,
          'location.latitude': eventToCreate.location.latitude,
          'location.longitude': eventToCreate.location.longitude,
          'organizerId': eventToCreate.organizerId,
          'organizerPhoto': eventToCreate.organizerPhoto,
          'imageUrl': eventToCreate.imageUrl,
          'images': eventToCreate.images,
          'tags': eventToCreate.tags,
        });

        // ✅ VÉRIFICATION FINALE DES CHAMPS REQUIS
        const requiredFields = [
          'title', 'description', 'date', 'location',
          'organizerId', 'organizerName', 'maxParticipants',
          'currentParticipants', 'participants', 'category',
          'isPrivate', 'requiresApproval', 'createdAt', 'updatedAt',
          'imageUrl', 'images', 'tags'
        ];

        const missingFields = requiredFields.filter(field => !(field in eventToCreate));
        if (missingFields.length > 0) {
          console.error('❌ [DEBUG] CHAMPS MANQUANTS:', missingFields);
          throw new Error(`Champs manquants: ${missingFields.join(', ')}`);
        } else {
          console.log('✅ [DEBUG] Tous les champs requis sont présents');
        }

        const eventsRef = collection(this.firestore, this.eventsCollection);
        
        console.log('🔍 [DEBUG] Tentative de création dans Firestore...');

        return from(addDoc(eventsRef, eventToCreate)).pipe(
          switchMap(docRef => {
            const eventId = docRef.id;
            console.log('✅ [DEBUG] Événement créé avec succès! ID:', eventId);

            // Crée le document participant pour l'organisateur
            const participantData: Omit<Participant, 'id'> = {
              eventId,
              userId,
              userName: userName || userEmail || 'Organisateur',
              userEmail: userEmail || '',
              userPhoto: organizerPhoto,
              joinedAt: Timestamp.now(),
              status: ParticipantStatus.APPROVED
            };

            console.log('🔍 [DEBUG] Création du participant organisateur:', participantData);

            const participantsRef = collection(this.firestore, this.participantsCollection);
            
            return from(addDoc(participantsRef, participantData)).pipe(
              map(() => {
                console.log('✅ [DEBUG] Organisateur ajouté comme participant');
                return eventId;
              })
            );
          })
        );
      })
    );
  }

  // ... (reste des méthodes inchangé)
  
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

  deleteEvent(eventId: string): Observable<void> {
    const eventDocRef = doc(this.firestore, this.eventsCollection, eventId);

    return from(deleteDoc(eventDocRef)).pipe(
      map(() => {
        console.log('✅ Événement supprimé:', eventId);
      })
    );
  }

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

  filterEventsByCategory(category: EventCategory): Observable<Event[]> {
    return this.getAllEvents().pipe(
      map(events => events.filter(event => event.category === category))
    );
  }
}