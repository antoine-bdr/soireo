// src/app/core/services/event-checkin.service.ts
// ✅ SÉCURISÉ (ÉTAPE 9) - Vérifications permissions ajoutées

import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  Timestamp,
  arrayUnion,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable, from, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { ParticipantsService } from './participants.service';
import { EventsService } from './events.service';
import { EventCheckIn, EventStatus } from '../models/event.model';
import { ParticipantStatus } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class EventCheckInService {
  private firestore = inject(Firestore);
  private authService = inject(AuthenticationService);
  private participantsService = inject(ParticipantsService);
  private eventsService = inject(EventsService);
  
  /**
   * ✅ SÉCURISÉ : Effectue un check-in avec vérifications
   */
  checkIn(eventId: string, method: 'manual' | 'qr' = 'manual'): Observable<void> {
    const userId = this.authService.getCurrentUserId();
    const userName = this.authService.getCurrentUserDisplayName();
    
    if (!userId) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }
    
    // ✅ VÉRIFIER statut participant
    return this.participantsService.getParticipantDocumentRealtime(eventId, userId).pipe(
      switchMap(participant => {
        if (!participant || participant.status !== ParticipantStatus.APPROVED) {
          return throwError(() => new Error('Vous devez être participant confirmé pour faire un check-in'));
        }
        
        // ✅ VÉRIFIER statut événement
        return this.eventsService.getEventById(eventId);
      }),
      switchMap(event => {
        if (event?.status !== EventStatus.ONGOING) {
          return throwError(() => new Error('Le check-in n\'est disponible que pendant l\'événement'));
        }
        
        if (event.allowCheckIn === false) {
          return throwError(() => new Error('Le check-in n\'est pas activé pour cet événement'));
        }
        
        // ✅ Procéder au check-in
        const checkInData: Omit<EventCheckIn, 'id'> = {
          eventId,
          userId,
          userName: userName || 'Participant',
          checkInTime: Timestamp.now(),
          method
        };
        
        return from(addDoc(collection(this.firestore, 'checkIns'), checkInData)).pipe(
          switchMap(() => {
            const eventRef = doc(this.firestore, 'events', eventId);
            return from(updateDoc(eventRef, {
              actualAttendees: arrayUnion(userId),
              updatedAt: Timestamp.now()
            }));
          }),
          map(() => void 0)
        );
      })
    );
  }
  
  /**
   * Vérifie si un utilisateur a fait son check-in
   */
  hasCheckedIn(eventId: string, userId?: string): Observable<boolean> {
    const uid = userId || this.authService.getCurrentUserId();
    
    if (!uid) return from([false]);
    
    return new Observable<boolean>(observer => {
      const checkInsRef = collection(this.firestore, 'checkIns');
      const q = query(
        checkInsRef,
        where('eventId', '==', eventId),
        where('userId', '==', uid)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        observer.next(!snapshot.empty);
      });
      
      return () => unsubscribe();
    });
  }
  
  /**
   * Obtient la liste des check-ins pour un événement
   */
  getEventCheckIns(eventId: string): Observable<EventCheckIn[]> {
    return new Observable<EventCheckIn[]>(observer => {
      const checkInsRef = collection(this.firestore, 'checkIns');
      const q = query(checkInsRef, where('eventId', '==', eventId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const checkIns = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as EventCheckIn));
        
        observer.next(checkIns);
      });
      
      return () => unsubscribe();
    });
  }
  
  /**
   * Obtient le nombre de check-ins
   */
  getCheckInCount(eventId: string): Observable<number> {
    return this.getEventCheckIns(eventId).pipe(
      map(checkIns => checkIns.length)
    );
  }
  
  /**
   * Génère un QR code pour check-in (côté organisateur)
   */
  generateCheckInQRCode(eventId: string): string {
    const timestamp = Date.now();
    const data = `eventapp://checkin/${eventId}/${timestamp}`;
    return btoa(data);
  }
  
  /**
   * Valide et effectue un check-in par QR code
   */
  checkInWithQRCode(qrCodeData: string): Observable<void> {
    try {
      const decoded = atob(qrCodeData);
      const parts = decoded.split('/');
      
      if (parts.length < 4 || parts[0] !== 'eventapp:' || parts[2] !== 'checkin') {
        throw new Error('QR code invalide');
      }
      
      const eventId = parts[3];
      return this.checkIn(eventId, 'qr');
      
    } catch (error) {
      throw new Error('QR code invalide ou expiré');
    }
  }
  
  /**
   * Obtient les statistiques de présence
   */
  getAttendanceStats(eventId: string, totalParticipants: number): Observable<{
    checkedIn: number;
    pending: number;
    attendanceRate: number;
  }> {
    return this.getCheckInCount(eventId).pipe(
      map(checkedIn => ({
        checkedIn,
        pending: totalParticipants - checkedIn,
        attendanceRate: totalParticipants > 0 
          ? Math.round((checkedIn / totalParticipants) * 100) 
          : 0
      }))
    );
  }
}