// src/app/core/services/event-announcements.service.ts
// Service de gestion des annonces/posts sur les événements
// ✅ Alternative simple au chat de groupe pour v1

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
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { EventAnnouncement } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class EventAnnouncementsService {
  private firestore = inject(Firestore);
  private authService = inject(AuthenticationService);
  
  /**
   * Crée une nouvelle annonce
   */
  createAnnouncement(
    eventId: string,
    message: string,
    type: 'info' | 'update' | 'alert' | 'photo' = 'info',
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
      orderBy('timestamp', 'desc')  // ✅ Retirer orderBy('isPinned', 'desc')
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
   * Poste une photo avec légende
   */
  postEventPhoto(
    eventId: string,
    photoUrl: string,
    caption?: string
  ): Observable<string> {
    return this.createAnnouncement(
      eventId,
      caption || '📸 Nouvelle photo',
      'photo',
      [photoUrl]
    );
  }
  
  /**
   * Envoie une alerte importante
   */
  sendAlert(eventId: string, message: string): Observable<string> {
    return this.createAnnouncement(eventId, `⚠️ ${message}`, 'alert');
  }
  
  /**
   * Compte le nombre d'annonces non lues
   * (Simplifiée pour v1 - pas de tracking individuel)
   */
  getAnnouncementCount(eventId: string): Observable<number> {
    return this.getEventAnnouncements(eventId).pipe(
      map(announcements => announcements.length)
    );
  }
}