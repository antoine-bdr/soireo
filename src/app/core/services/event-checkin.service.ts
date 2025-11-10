// src/app/core/services/event-checkin.service.ts
// Service de gestion des check-ins
// ✅ Gère les présences réelles aux événements

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
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { EventCheckIn } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class EventCheckInService {
  private firestore = inject(Firestore);
  private authService = inject(AuthenticationService);
  
  /**
   * Effectue un check-in à un événement
   */
  checkIn(eventId: string, method: 'manual' | 'qr' = 'manual'): Observable<void> {
    const userId = this.authService.getCurrentUserId();
    const userName = this.authService.getCurrentUserDisplayName();
    
    if (!userId) {
      throw new Error('Utilisateur non connecté');
    }
    
    // Créer le document check-in
    const checkInData: Omit<EventCheckIn, 'id'> = {
      eventId,
      userId,
      userName: userName || 'Participant',
      checkInTime: Timestamp.now(),
      method
    };
    
    // Ajouter le check-in et mettre à jour l'événement
    return from(addDoc(collection(this.firestore, 'checkIns'), checkInData)).pipe(
      switchMap(() => {
        // Mettre à jour la liste des présents dans l'événement
        const eventRef = doc(this.firestore, 'events', eventId);
        return from(updateDoc(eventRef, {
          actualAttendees: arrayUnion(userId),
          updatedAt: Timestamp.now()
        }));
      }),
      map(() => void 0)
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
    // Format: eventapp://checkin/{eventId}/{timestamp}
    const timestamp = Date.now();
    const data = `eventapp://checkin/${eventId}/${timestamp}`;
    
    // Encoder en base64 pour simplicité
    return btoa(data);
  }
  
  /**
   * Valide et effectue un check-in par QR code
   */
  checkInWithQRCode(qrCodeData: string): Observable<void> {
    try {
      // Décoder le QR code
      const decoded = atob(qrCodeData);
      const parts = decoded.split('/');
      
      if (parts.length < 4 || parts[0] !== 'eventapp:' || parts[2] !== 'checkin') {
        throw new Error('QR code invalide');
      }
      
      const eventId = parts[3];
      
      // Effectuer le check-in
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