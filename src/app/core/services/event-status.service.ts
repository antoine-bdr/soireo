// src/app/core/services/event-status.service.ts
// Service de gestion automatique des statuts
// ✅ Met à jour les statuts en temps réel

import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, updateDoc, Timestamp, writeBatch } from '@angular/fire/firestore';
import { Observable, interval, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Event, EventStatus } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class EventStatusService {
  private firestore = inject(Firestore);
  
  /**
   * Calcule le statut actuel d'un événement
   */
  calculateEventStatus(event: Event): EventStatus {
    const now = new Date().getTime();
    const eventStart = event.startTime?.toMillis() || event.date.toMillis();
    const eventEnd = event.endTime?.toMillis() || eventStart + (3 * 60 * 60 * 1000); // +3h par défaut
    
    // Si annulé, reste annulé
    if (event.status === EventStatus.CANCELLED) {
      return EventStatus.CANCELLED;
    }
    
    // Calcul basé sur les dates
    if (now < eventStart) {
      return EventStatus.UPCOMING;
    } else if (now >= eventStart && now <= eventEnd) {
      return EventStatus.ONGOING;
    } else {
      return EventStatus.COMPLETED;
    }
  }
  
  /**
   * Met à jour le statut d'un événement
   */
  async updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
    const eventRef = doc(this.firestore, 'events', eventId);
    
    await updateDoc(eventRef, {
      status,
      lastStatusUpdate: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    console.log(`✅ Statut mis à jour: ${eventId} → ${status}`);
  }
  
  /**
   * Vérifie et met à jour plusieurs événements
   */
  async updateMultipleEventStatuses(events: Event[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    let updatedCount = 0;
    
    events.forEach(event => {
      if (!event.id) return;
      
      const newStatus = this.calculateEventStatus(event);
      
      // Ne met à jour que si le statut a changé
      if (event.status !== newStatus) {
        const eventRef = doc(this.firestore, 'events', event.id);
        batch.update(eventRef, {
          status: newStatus,
          lastStatusUpdate: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ ${updatedCount} statuts mis à jour`);
    }
  }
  
  /**
   * Annule un événement
   */
  async cancelEvent(eventId: string, reason?: string): Promise<void> {
    const eventRef = doc(this.firestore, 'events', eventId);
    
    await updateDoc(eventRef, {
      status: EventStatus.CANCELLED,
      cancellationReason: reason || 'Événement annulé',
      lastStatusUpdate: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    // TODO: Envoyer notification aux participants
    console.log(`❌ Événement annulé: ${eventId}`);
  }
  
  /**
   * Démarre un watcher automatique (à appeler dans app.component)
   * Vérifie toutes les 5 minutes
   */
  startStatusWatcher(): Observable<void> {
    return interval(5 * 60 * 1000).pipe( // Toutes les 5 minutes
      map(() => {
        console.log('🔄 Vérification des statuts...');
        // Cette méthode sera appelée depuis le composant principal
        // qui fournira la liste des événements à vérifier
      })
    );
  }
  
  /**
   * Obtient les actions disponibles selon le statut
   */
  getAvailableActions(event: Event, isOrganizer: boolean): string[] {
    const actions: string[] = [];
    
    switch (event.status || EventStatus.UPCOMING) {
      case EventStatus.UPCOMING:
        if (isOrganizer) {
          actions.push('edit', 'cancel', 'sendReminder');
        }
        actions.push('invite', 'share');
        break;
        
      case EventStatus.ONGOING:
        actions.push('checkIn', 'uploadPhoto', 'postUpdate');
        if (isOrganizer) {
          actions.push('makeAnnouncement');
        }
        break;
        
      case EventStatus.COMPLETED:
        actions.push('uploadPhotos', 'viewPhotos', 'writeReview');
        if (isOrganizer) {
          actions.push('thankParticipants', 'downloadPhotos');
        }
        break;
        
      case EventStatus.CANCELLED:
        // Pas d'actions pour les événements annulés
        break;
    }
    
    return actions;
  }
  
  /**
   * Obtient le label et la couleur pour affichage UI
   */
  getStatusDisplay(status: EventStatus): { label: string; color: string; icon: string } {
    switch (status) {
      case EventStatus.UPCOMING:
        return {
          label: 'À venir',
          color: 'primary',
          icon: 'calendar-outline'
        };
        
      case EventStatus.ONGOING:
        return {
          label: 'En cours',
          color: 'success',
          icon: 'radio-outline'
        };
        
      case EventStatus.COMPLETED:
        return {
          label: 'Terminé',
          color: 'medium',
          icon: 'checkmark-circle-outline'
        };
        
      case EventStatus.CANCELLED:
        return {
          label: 'Annulé',
          color: 'danger',
          icon: 'close-circle-outline'
        };
        
      default:
        return {
          label: 'Inconnu',
          color: 'medium',
          icon: 'help-circle-outline'
        };
    }
  }
  
  /**
   * Vérifie si un événement peut accepter des check-ins
   */
  canCheckIn(event: Event): boolean {
    return event.status === EventStatus.ONGOING && 
           (event.allowCheckIn !== false);
  }
  
  /**
   * Vérifie si on peut encore rejoindre l'événement
   */
  canJoinEvent(event: Event): boolean {
    return event.status === EventStatus.UPCOMING || 
           event.status === EventStatus.ONGOING;
  }
  
  /**
   * Vérifie si on peut poster des photos
   */
  canPostPhotos(event: Event): boolean {
    return event.status === EventStatus.ONGOING || 
           event.status === EventStatus.COMPLETED;
  }
}