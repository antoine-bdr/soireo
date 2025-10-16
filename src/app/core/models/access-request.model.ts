import { Timestamp } from '@angular/fire/firestore';

export interface AccessRequest {
  id?: string;                    // ID du document Firestore
  eventId: string;                // ID de l'événement
  eventTitle: string;             // Titre de l'événement (dénormalisé)
  userId: string;                 // ID de l'utilisateur demandeur
  userName: string;               // Nom de l'utilisateur (dénormalisé)
  userPhoto: string;              // Photo de l'utilisateur (dénormalisé)
  status: RequestStatus;          // Statut de la demande
  message: string;                // Message de motivation (optionnel)
  createdAt: Timestamp;           // Date de la demande
  respondedAt?: Timestamp;        // Date de réponse
  respondedBy?: string;           // ID de qui a répondu
}

// Statuts possibles d'une demande
export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}