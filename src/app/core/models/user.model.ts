import { Timestamp } from '@angular/fire/firestore';

export interface User {
  uid: string;                    // ID unique Firebase Auth
  email: string;                  // Email de l'utilisateur
  displayName: string;            // Nom d'affichage
  photoURL: string;               // URL de la photo de profil
  bio: string;                    // Biographie / Description
  interests: string[];            // Liste des centres d'intérêt
  createdAt: Timestamp;           // Date de création du compte
  updatedAt: Timestamp;           // Dernière mise à jour du profil
  eventsOrganized: string[];      // IDs des événements organisés
  eventsAttended: string[];       // IDs des événements auxquels il participe
}

// DTO pour la création d'un utilisateur (sans champs auto-générés)
export interface CreateUserDto {
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  interests?: string[];
}