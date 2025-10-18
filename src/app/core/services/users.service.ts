// src/app/core/services/users.service.ts
// Service de gestion des profils utilisateurs
// 🎯 Sprint 4 - Profil Utilisateur

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
  increment
} from '@angular/fire/firestore';
import { 
  Storage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from '@angular/fire/storage';
import { Auth, user } from '@angular/fire/auth'; // ✅ MODIFIÉ : Ajout de user
import { Observable, from, map, switchMap, of } from 'rxjs';
import { 
  User, 
  CreateUserDto, 
  UpdateUserDto, 
  UserPublicProfile 
} from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  // ========================================
  // INJECTION DES DÉPENDANCES
  // ========================================
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth); // ✅ MODIFIÉ : Injection directe de Auth
  
  // Nom de la collection Firestore
  private readonly usersCollection = 'users';
  private readonly storageFolder = 'profiles';

  constructor() {}

  // ========================================
  // 🔨 CRÉATION DE PROFIL
  // ========================================

  /**
   * Crée un nouveau profil utilisateur dans Firestore
   * ⚠️ IMPORTANT : Utilisé automatiquement lors de l'inscription
   * 
   * @param userData - Données du profil à créer
   * @returns Observable<void>
   */
  createUserProfile(userData: CreateUserDto): Observable<void> {
    console.log('🔨 Création profil utilisateur:', userData.email);

    // Prépare les données complètes pour Firestore
    const userProfile: Omit<User, 'id'> = {
      email: userData.email,
      displayName: userData.displayName,
      firstName: userData.firstName,
      lastName: userData.lastName,
      photoURL: userData.photoURL || '',
      bio: '',
      phoneNumber: '',
      interests: [],
      favoriteCategories: [],
      city: '',
      country: '',
      eventsCreatedCount: 0,
      eventsJoinedCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      isActive: true,
      isEmailVerified: userData.isEmailVerified || false,
      notificationsEnabled: true
    };

    // Utilise l'UID comme ID du document (synchronisation Auth ↔ Firestore)
    const userDocRef = doc(this.firestore, this.usersCollection, userData.id);

    return from(setDoc(userDocRef, userProfile)).pipe(
      map(() => {
        console.log('✅ Profil utilisateur créé dans Firestore');
      })
    );
  }

  // ========================================
  // 📖 LECTURE DE PROFIL
  // ========================================

  /**
   * Récupère le profil d'un utilisateur (TEMPS RÉEL)
   * Écoute les changements en temps réel via onSnapshot
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<User | null>
   */
  getUserProfile(userId: string): Observable<User | null> {
    return new Observable(observer => {
      const userDocRef = doc(this.firestore, this.usersCollection, userId);

      const unsubscribe = onSnapshot(
        userDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data() as Omit<User, 'id'>;
            const user: User = {
              id: snapshot.id,
              ...userData
            };
            console.log('📖 Profil utilisateur récupéré:', user.displayName);
            observer.next(user);
          } else {
            console.warn('⚠️ Profil utilisateur introuvable:', userId);
            observer.next(null);
          }
        },
        (error) => {
          console.error('❌ Erreur récupération profil:', error);
          observer.error(error);
        }
      );

      // Cleanup de la subscription
      return () => unsubscribe();
    });
  }

  /**
   * Récupère le profil d'un utilisateur (UNE SEULE FOIS)
   * Utile pour les vérifications ponctuelles
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<User | null>
   */
  getUserProfileOnce(userId: string): Observable<User | null> {
    const userDocRef = doc(this.firestore, this.usersCollection, userId);

    return from(getDoc(userDocRef)).pipe(
      map((snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() as Omit<User, 'id'>;
          return {
            id: snapshot.id,
            ...userData
          } as User;
        }
        return null;
      })
    );
  }

  /**
   * Récupère le profil PUBLIC d'un utilisateur
   * Données limitées pour afficher un profil public
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<UserPublicProfile | null>
   */
  getUserPublicProfile(userId: string): Observable<UserPublicProfile | null> {
    return this.getUserProfileOnce(userId).pipe(
      map(user => {
        if (!user) return null;

        return {
          id: user.id,
          displayName: user.displayName,
          photoURL: user.photoURL,
          bio: user.bio,
          city: user.city,
          eventsCreatedCount: user.eventsCreatedCount,
          eventsJoinedCount: user.eventsJoinedCount,
          memberSince: user.createdAt
        } as UserPublicProfile;
      })
    );
  }

  /**
   * Récupère le profil de l'utilisateur COURANT
   * Raccourci pratique pour l'utilisateur connecté
   * 
   * @returns Observable<User | null>
   */
  getCurrentUserProfile(): Observable<User | null> {
    const userId = this.auth.currentUser?.uid; // ✅ MODIFIÉ : Utilisation directe de auth
    if (!userId) {
      console.warn('⚠️ Aucun utilisateur connecté');
      return of(null);
    }
    return this.getUserProfile(userId);
  }

  // ========================================
  // ✏️ MISE À JOUR DE PROFIL
  // ========================================

  /**
   * Met à jour le profil d'un utilisateur (PARTIEL)
   * Seuls les champs fournis sont mis à jour
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @param updates - Champs à mettre à jour
   * @returns Observable<void>
   */
  updateUserProfile(userId: string, updates: UpdateUserDto): Observable<void> {
    console.log('✏️ Mise à jour profil utilisateur:', userId);

    const userDocRef = doc(this.firestore, this.usersCollection, userId);

    // Ajoute automatiquement la date de mise à jour
    const dataToUpdate = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    return from(updateDoc(userDocRef, dataToUpdate)).pipe(
      map(() => {
        console.log('✅ Profil utilisateur mis à jour');
      })
    );
  }

  /**
   * Met à jour la date de dernière connexion
   * Appelé automatiquement lors du login
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<void>
   */
  updateLastLogin(userId: string): Observable<void> {
    const userDocRef = doc(this.firestore, this.usersCollection, userId);

    return from(updateDoc(userDocRef, {
      lastLoginAt: Timestamp.now()
    })).pipe(
      map(() => {
        console.log('🕐 Dernière connexion mise à jour');
      })
    );
  }

  // ========================================
  // 🗑️ SUPPRESSION DE PROFIL
  // ========================================

  /**
   * Supprime le profil d'un utilisateur de Firestore
   * ⚠️ NE SUPPRIME PAS le compte Firebase Auth
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<void>
   */
  deleteUserProfile(userId: string): Observable<void> {
    console.log('🗑️ Suppression profil utilisateur:', userId);

    const userDocRef = doc(this.firestore, this.usersCollection, userId);

    return from(deleteDoc(userDocRef)).pipe(
      map(() => {
        console.log('✅ Profil utilisateur supprimé de Firestore');
      })
    );
  }

  // ========================================
  // 📸 GESTION PHOTO DE PROFIL
  // ========================================

  /**
   * Upload une photo de profil vers Firebase Storage
   * Génère un nom unique et retourne l'URL de téléchargement
   * 
   * @param file - Fichier image à uploader
   * @param userId - UID Firebase de l'utilisateur
   * @returns Promise<string> - URL de la photo uploadée
   */
  async uploadProfilePhoto(file: File, userId: string): Promise<string> {
    console.log('📸 Upload photo de profil pour:', userId);

    // Génère un nom unique pour l'image
    const timestamp = Date.now();
    const fileName = `${userId}_${timestamp}.jpg`;
    const filePath = `${this.storageFolder}/${fileName}`;

    // Créé la référence Firebase Storage
    const storageRef = ref(this.storage, filePath);

    try {
      // Upload le fichier
      const snapshot = await uploadBytes(storageRef, file);
      console.log('✅ Photo uploadée dans Storage');

      // Récupère l'URL de téléchargement
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('✅ URL photo de profil:', downloadURL);

      return downloadURL;
    } catch (error) {
      console.error('❌ Erreur upload photo:', error);
      throw error;
    }
  }

  /**
   * Supprime une photo de profil de Firebase Storage
   * Utilise l'URL pour retrouver le fichier
   * 
   * @param photoURL - URL de la photo à supprimer
   * @returns Promise<void>
   */
  async deleteProfilePhoto(photoURL: string): Promise<void> {
    if (!photoURL) return;

    console.log('🗑️ Suppression photo de profil');

    try {
      // Extrait le chemin du fichier depuis l'URL
      const storageRef = ref(this.storage, photoURL);
      await deleteObject(storageRef);
      console.log('✅ Photo de profil supprimée de Storage');
    } catch (error) {
      console.error('❌ Erreur suppression photo:', error);
      throw error;
    }
  }

  // ========================================
  // 📊 STATISTIQUES UTILISATEUR
  // ========================================

  /**
   * Incrémente le compteur d'événements créés
   * Appelé automatiquement lors de la création d'un événement
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<void>
   */
  incrementEventsCreated(userId: string): Observable<void> {
    const userDocRef = doc(this.firestore, this.usersCollection, userId);

    return from(updateDoc(userDocRef, {
      eventsCreatedCount: increment(1)
    })).pipe(
      map(() => {
        console.log('📊 Compteur événements créés incrémenté');
      })
    );
  }

  /**
   * Décrémente le compteur d'événements créés
   * Appelé automatiquement lors de la suppression d'un événement
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<void>
   */
  decrementEventsCreated(userId: string): Observable<void> {
    const userDocRef = doc(this.firestore, this.usersCollection, userId);

    return from(updateDoc(userDocRef, {
      eventsCreatedCount: increment(-1)
    })).pipe(
      map(() => {
        console.log('📊 Compteur événements créés décrémenté');
      })
    );
  }

  /**
   * Incrémente le compteur d'événements rejoints
   * Appelé automatiquement lors de la participation à un événement
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<void>
   */
  incrementEventsJoined(userId: string): Observable<void> {
    const userDocRef = doc(this.firestore, this.usersCollection, userId);

    return from(updateDoc(userDocRef, {
      eventsJoinedCount: increment(1)
    })).pipe(
      map(() => {
        console.log('📊 Compteur événements rejoints incrémenté');
      })
    );
  }

  /**
   * Décrémente le compteur d'événements rejoints
   * Appelé automatiquement lors du départ d'un événement
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<void>
   */
  decrementEventsJoined(userId: string): Observable<void> {
    const userDocRef = doc(this.firestore, this.usersCollection, userId);

    return from(updateDoc(userDocRef, {
      eventsJoinedCount: increment(-1)
    })).pipe(
      map(() => {
        console.log('📊 Compteur événements rejoints décrémenté');
      })
    );
  }

  // ========================================
  // 🔄 SYNCHRONISATION FIREBASE AUTH
  // ========================================

  /**
   * Synchronise les données Firebase Auth avec Firestore
   * Met à jour displayName et photoURL si modifiés dans Auth
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<void>
   */
  syncWithFirebaseAuth(userId: string): Observable<void> {
    return user(this.auth).pipe( // ✅ MODIFIÉ : Utilisation de user(auth)
      switchMap(authUser => {
        if (!authUser) {
          console.warn('⚠️ Aucun utilisateur Auth trouvé');
          return of(void 0);
        }

        // Met à jour Firestore avec les données Auth
        const updates: UpdateUserDto = {
          displayName: authUser.displayName || undefined,
          photoURL: authUser.photoURL || undefined
        };

        return this.updateUserProfile(userId, updates);
      })
    );
  }

  // ========================================
  // 🔍 RECHERCHE UTILISATEURS
  // ========================================

  /**
   * Recherche des utilisateurs par nom
   * Utile pour mentionner des utilisateurs ou rechercher des profils
   * 
   * @param searchQuery - Terme de recherche
   * @returns Observable<User[]>
   */
  searchUsers(searchQuery: string): Observable<User[]> {
    console.log('🔍 Recherche utilisateurs:', searchQuery);

    const usersRef = collection(this.firestore, this.usersCollection);
    
    // Recherche simple par displayName (Firebase ne supporte pas le full-text search)
    // Pour une recherche avancée, utiliser Algolia ou ElasticSearch
    const q = query(
      usersRef,
      where('displayName', '>=', searchQuery),
      where('displayName', '<=', searchQuery + '\uf8ff')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User));
      })
    );
  }
}