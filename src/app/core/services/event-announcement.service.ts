// src/app/core/services/event-announcement.service.ts
// Service de gestion des annonces/posts sur les événements
// ✅ VERSION MISE À JOUR avec nouveaux types

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
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { EventAnnouncement } from '../models/event.model';
import { getDocs, writeBatch } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class EventAnnouncementsService {
  private firestore = inject(Firestore);
  private authService = inject(AuthenticationService);
  
  /**
   * Crée une nouvelle annonce
   * ✅ TYPES MIS À JOUR
   */
  createAnnouncement(
    eventId: string,
    message: string,
    type: 'info' | 'important' | 'reminder' | 'live' | 'thanks' = 'info',
    images?: string[]
  ): Observable<string> {
    const userId = this.authService.getCurrentUserId();
    const userName = this.authService.getCurrentUserDisplayName();
    
    if (!userId) {
      throw new Error('Utilisateur non connecté');
    }
    
    const announcement: Omit<EventAnnouncement, 'id'> = {
      eventId,
      authorId: userId,
      authorName: userName || 'Organisateur',
      message,
      images: images || [],
      timestamp: Timestamp.now(),
      type,
      isPinned: false
    };
    
    return from(
      addDoc(collection(this.firestore, 'eventAnnouncements'), announcement)
    ).pipe(
      map(docRef => docRef.id)
    );
  }
  
  /**
   * Récupère les annonces d'un événement
   */
  getEventAnnouncements(eventId: string): Observable<EventAnnouncement[]> {
    return new Observable<EventAnnouncement[]>(observer => {
      const announcementsRef = collection(this.firestore, 'eventAnnouncements');
      const q = query(
        announcementsRef,
        where('eventId', '==', eventId),
        orderBy('timestamp', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const announcements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as EventAnnouncement));
        
        console.log(`✅ [EventAnnouncementsService] ${announcements.length} annonces récupérées`);
        observer.next(announcements);
      }, (error) => {
        console.error('❌ [EventAnnouncementsService] Erreur:', error);
        observer.error(error);
      });
      
      return () => unsubscribe();
    });
  }
  
  /**
   * Épingle/désépingle une annonce (organisateur uniquement)
   */
  togglePin(announcementId: string, isPinned: boolean): Observable<void> {
    const announcementRef = doc(this.firestore, 'eventAnnouncements', announcementId);
    
    return from(
      updateDoc(announcementRef, { isPinned })
    ).pipe(
      map(() => void 0)
    );
  }
  
  /**
   * Supprime une annonce
   */
  deleteAnnouncement(announcementId: string): Observable<void> {
    const announcementRef = doc(this.firestore, 'eventAnnouncements', announcementId);
    
    return from(deleteDoc(announcementRef)).pipe(
      map(() => void 0)
    );
  }
  
  /**
   * ✅ Envoie une alerte importante
   */
  sendAlert(eventId: string, message: string): Observable<string> {
    return this.createAnnouncement(eventId, `⚠️ ${message}`, 'important');
  }

  /**
   * ✅ Envoie un rappel
   */
  sendReminder(eventId: string, message: string): Observable<string> {
    return this.createAnnouncement(eventId, `⏰ ${message}`, 'reminder');
  }

  /**
   * ✅ Envoie une annonce en direct
   */
  sendLiveUpdate(eventId: string, message: string): Observable<string> {
    return this.createAnnouncement(eventId, `🔴 ${message}`, 'live');
  }

  /**
   * ✅ Envoie des remerciements
   */
  sendThanks(eventId: string, message: string): Observable<string> {
    return this.createAnnouncement(eventId, `💝 ${message}`, 'thanks');
  }
  
  /**
   * Compte le nombre d'annonces
   */
  getAnnouncementCount(eventId: string): Observable<number> {
    return this.getEventAnnouncements(eventId).pipe(
      map(announcements => announcements.length)
    );
  }

  deleteEventAnnouncements(eventId: string): Observable<void> {
    console.log(`🗑️ Suppression de toutes les annonces pour l'événement ${eventId}`);
    
    const announcementsRef = collection(this.firestore, 'eventAnnouncements');
    const q = query(announcementsRef, where('eventId', '==', eventId));
    
    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        if (snapshot.empty) {
          console.log('ℹ️ Aucune annonce à supprimer');
          return of(void 0);
        }
        
        // Utiliser un batch pour supprimer tous les documents
        const batch = writeBatch(this.firestore);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        return from(batch.commit()).pipe(
          map(() => {
            console.log(`✅ ${snapshot.size} annonce(s) supprimée(s)`);
          })
        );
      }),
      catchError(error => {
        console.error('❌ Erreur suppression annonces:', error);
        // Ne pas bloquer le processus principal
        return of(void 0);
      })
    );
  }
}