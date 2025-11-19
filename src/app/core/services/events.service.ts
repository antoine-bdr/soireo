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
import { Observable, from, map, switchMap, take, of, throwError, catchError, combineLatest } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { UsersService } from './users.service';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../models/notification.model';
import { Event, CreateEventDto, EventCategory, EventAnnouncement } from '../models/event.model';
import { Participant, ParticipantStatus } from '../models/participant.model';
import { ParticipantsService } from './participants.service';
import { InvitationsService } from './invitations.service';
import { EventAnnouncementsService } from './event-announcement.service';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  private readonly usersService = inject(UsersService);
  
  private readonly eventsCollection = 'events';
  private readonly participantsCollection = 'participants';

  private readonly notificationsService = inject(NotificationsService);

  private readonly announcementsCollection = 'eventAnnouncements';

  private readonly participantsService = inject(ParticipantsService);
  private readonly invitationsService = inject(InvitationsService);
  private readonly eventAnnouncementsService = inject(EventAnnouncementsService);
  private readonly storageService = inject(StorageService);

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
          accessType: eventData.accessType,  // ✅ Type d'accès (public/private/invite_only)
          requiresApproval: eventData.requiresApproval,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          tags: eventData.tags || [],
          // ✅ Conversion Date → Timestamp uniquement si définis
          ...(eventData.startTime && { startTime: Timestamp.fromDate(eventData.startTime) }),
          ...(eventData.endTime && { endTime: Timestamp.fromDate(eventData.endTime) })
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
          'accessType', 'requiresApproval', 'createdAt', 'updatedAt',  // ✅ MODIFIÉ : accessType au lieu de isPrivate
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


  createEventAnnouncement(announcement: Omit<EventAnnouncement, 'id' | 'timestamp'>): Observable<string> {
    const currentUserId = this.authService.getCurrentUserId();
  
    if (!currentUserId) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }
  
    const announcementToCreate = {
      ...announcement,
      timestamp: Timestamp.now()
    };
  
    // Récupérer l'événement pour avoir les participants
    return this.getEventById(announcement.eventId).pipe(
      take(1),
      switchMap(event => {
        if (!event) {
          throw new Error('Événement introuvable');
        }
  
        const announcementsRef = collection(this.firestore, this.announcementsCollection);
        
        // Créer l'annonce
        return from(addDoc(announcementsRef, announcementToCreate)).pipe(
          switchMap(docRef => {
            const announcementId = docRef.id;
            
            // Filtrer les participants (exclure l'auteur)
            const participantsToNotify = event.participants.filter(
              userId => userId !== currentUserId
            );
  
            if (participantsToNotify.length === 0) {
              return of(announcementId);
            }
  
            // Créer les notifications pour chaque participant
            const notificationPromises = participantsToNotify.map(userId =>
              this.notificationsService.createOrUpdateNotification({
                userId,
                type: NotificationType.SYSTEM,  // ✅ CHANGER (publications = SYSTEM)
                title: 'Nouvelle publication',  // ✅ CHANGER
                message: `${announcement.authorName} a publié dans l'événement "${event.title}"`,  // ✅ CHANGER
                icon: 'megaphone-outline',  // ✅ CHANGER
                color: 'primary',  // ✅ CHANGER
                relatedEntityId: event.id,
                relatedEntityType: 'event',
                actionUrl: `/events/${event.id}`,
                senderUserId: currentUserId ?? undefined,
                senderDisplayName: announcement.authorName,  // ✅ CHANGER
                groupKey: `announcement_${event.id}_${currentUserId}`,  // ✅ CHANGER (grouper par auteur)
                count: 1
              })
            );
  
            return from(Promise.all(notificationPromises)).pipe(
              map(() => {
                console.log(`✅ Publication créée et ${participantsToNotify.length} notifications envoyées`);
                return announcementId;
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

  updateEvent(
    eventId: string, 
    updates: Partial<Event>, 
    sendNotification: boolean = true  // ✅ AJOUTER ce paramètre
  ): Observable<void> {
    const eventDocRef = doc(this.firestore, this.eventsCollection, eventId);
    const currentUserId = this.authService.getCurrentUserId();
  
    const dataToUpdate = {
      ...updates,
      updatedAt: Timestamp.now()
    };
  
    // Récupérer l'événement avant mise à jour pour avoir les participants
    return this.getEventById(eventId).pipe(
      take(1),
      switchMap(event => {
        if (!event) {
          throw new Error('Événement introuvable');
        }
  
        // Mettre à jour l'événement
        return from(updateDoc(eventDocRef, dataToUpdate)).pipe(
          switchMap(() => {
            // ✅ CONDITION : Envoyer notifications uniquement si sendNotification = true
            if (!sendNotification) {
              console.log('ℹ️ Mise à jour silencieuse (pas de notification)');
              return of(void 0);
            }
  
            // Envoyer notifications aux participants (sauf organisateur)
            const participantsToNotify = event.participants.filter(
              userId => userId !== currentUserId
            );
  
            if (participantsToNotify.length === 0) {
              return of(void 0);
            }
  
            // Créer les notifications pour chaque participant
            const notificationPromises = participantsToNotify.map(userId =>
              this.notificationsService.createOrUpdateNotification({
                userId,
                type: NotificationType.EVENT_UPDATED,
                title: 'Événement modifié',
                message: `L'événement "${event.title}" a été mis à jour`,
                icon: 'create-outline',
                color: 'warning',
                relatedEntityId: eventId,
                relatedEntityType: 'event',
                actionUrl: `/events/${eventId}`,
                senderUserId: currentUserId ?? undefined,
                senderDisplayName: event.organizerName,
                groupKey: `event_updated_${eventId}`,  // ✅ AJOUTER
                count: 1  // ✅ AJOUTER
              })
            );
  
            return from(Promise.all(notificationPromises)).pipe(
              map(() => {
                console.log(`✅ Événement mis à jour et ${participantsToNotify.length} notifications envoyées`);
              })
            );
          })
        );
      })
    );
  }

  // Remplacer la méthode deleteEvent() (ligne 441-449)

  /**
 * 🗑️ Supprime un événement et TOUTES ses données associées
 * ✅ VERSION COMPLÈTE avec nettoyage
 * 
 * @param eventId - ID de l'événement à supprimer
 * @returns Observable<void>
 */
deleteEvent(eventId: string): Observable<void> {
  console.log(`🗑️ Suppression complète de l'événement ${eventId}`);
  
  // D'abord récupérer l'événement pour avoir les infos
  return this.getEventById(eventId).pipe(
    take(1),
    switchMap(event => {
      if (!event) {
        throw new Error('Événement non trouvé');
      }
      
      console.log(`📋 Suppression de l'événement "${event.title}"`);
      
      // 1. Notifier tous les participants AVANT la suppression
      const notifyPromise = event.participants.length > 0
        ? this.notificationsService.notifyEventCancelled(
            eventId,
            event.title,
            event.participants.filter(id => id !== event.organizerId)
          )
        : Promise.resolve();
      
      return from(notifyPromise).pipe(
        switchMap(() => {
          console.log('✅ Participants notifiés');
          
          // 2. Supprimer toutes les données associées en parallèle
          const cleanupOperations = [
            // Supprimer l'événement lui-même
            from(deleteDoc(doc(this.firestore, this.eventsCollection, eventId))),
            
            // Supprimer les participants
            this.participantsService.deleteAllEventParticipants(eventId),
            
            // Supprimer les invitations
            from(this.invitationsService.deleteEventInvitations(eventId)),
            
            // Supprimer les annonces
            this.eventAnnouncementsService.deleteEventAnnouncements(eventId),
            
            // Supprimer les notifications existantes
            from(this.notificationsService.deleteEventNotifications(eventId)),
            
            // Supprimer les photos du Storage si elles existent
            event.eventPhotos && Array.isArray(event.eventPhotos) && event.eventPhotos.length > 0
              ? from(this.deleteEventPhotos(event.eventPhotos as any[]))
              : of(void 0)
          ];
          
          // Exécuter toutes les suppressions en parallèle
          return combineLatest(cleanupOperations).pipe(
            map(() => {
              console.log(`✅ Événement ${eventId} et toutes ses données supprimés`);
            }),
            catchError(error => {
              console.error('❌ Erreur lors du nettoyage:', error);
              // L'événement principal est déjà supprimé, on continue
              return of(void 0);
            })
          );
        })
      );
    }),
    catchError(error => {
      console.error('❌ Erreur suppression événement:', error);
      throw error;
    })
  );
}

/**
 * 🗑️ Helper : Supprime les photos du Storage
 * 
 * @param photos - Tableau des photos
 * @returns Promise<void>
 */
private async deleteEventPhotos(photos: any[]): Promise<void> {
  console.log(`🗑️ Suppression de ${photos.length} photo(s)`);
  
  try {
    const deletePromises = photos
      .filter(photo => photo?.url)
      .map(photo => this.storageService.deleteImagePromise(photo.url).catch(err => {
        console.error(`⚠️ Erreur suppression photo:`, err);
        // Continuer même si une photo ne peut pas être supprimée
      }));
    
    await Promise.all(deletePromises);
    console.log('✅ Photos supprimées');
  } catch (error) {
    console.error('❌ Erreur suppression photos:', error);
    // Ne pas bloquer le processus principal
  }
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