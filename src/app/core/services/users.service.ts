// src/app/core/services/users.service.ts
// Service de gestion des profils utilisateurs ENRICHI
// 🎯 Sprint 4 - Profil Utilisateur ENRICHI

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
  increment,
  writeBatch
} from '@angular/fire/firestore';
import { 
  Storage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from '@angular/fire/storage';
import { Auth, user } from '@angular/fire/auth';
import { Observable, from, map, switchMap, of } from 'rxjs';
import { 
  User, 
  CreateUserDto, 
  UpdateUserDto, 
  UserPublicProfile,
  UserBadge,
  BadgeType,
  ProfileCompletionStatus,
  calculateAge
} from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  // ========================================
  // INJECTION DES DÉPENDANCES
  // ========================================

  private readonly usersCollection = 'users';
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  
  // Nom de la collection Firestore
  private readonly storageFolder = 'profiles';
  private readonly galleryFolder = 'profiles/gallery'; // NOUVEAU : Dossier galerie

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

    // Prépare les données complètes pour Firestore (AVEC NOUVEAUX CHAMPS)
    const userProfile: Omit<User, 'id'> = {
      email: userData.email,
      displayName: userData.displayName,
      firstName: userData.firstName,
      lastName: userData.lastName,
      photoURL: userData.photoURL || '',
      bio: '',
      phoneNumber: '',
      dateOfBirth: userData.dateOfBirth,        // NOUVEAU
      gender: undefined,                        // NOUVEAU
      profilePhotos: [],                        // NOUVEAU : Galerie vide
      interests: [],                            // NOUVEAU : Vide au départ
      musicStyles: [],                          // NOUVEAU : Vide au départ
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
   * Récupère le profil PUBLIC d'un utilisateur (ENRICHI)
   * Données limitées pour afficher un profil public
   * 
   * @param userId - UID Firebase de l'utilisateur
   * @returns Observable<UserPublicProfile | null>
   */
  getUserPublicProfile(userId: string): Observable<UserPublicProfile | null> {
    return this.getUserProfileOnce(userId).pipe(
      map(user => {
        if (!user) return null;

        // Calcul de l'âge si date de naissance disponible
        const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : undefined;

        // Récupération des badges
        const badges = this.getUserBadges(user);

        return {
          id: user.id,
          displayName: user.displayName,
          photoURL: user.photoURL,
          profilePhotos: user.profilePhotos || [],  // NOUVEAU
          bio: user.bio,
          age,                                       // NOUVEAU
          gender: user.gender,                       // NOUVEAU
          interests: user.interests || [],           // NOUVEAU
          musicStyles: user.musicStyles || [],       // NOUVEAU
          city: user.city,
          eventsCreatedCount: user.eventsCreatedCount,
          eventsJoinedCount: user.eventsJoinedCount,
          memberSince: user.createdAt,
          badges                                     // NOUVEAU
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
    const userId = this.auth.currentUser?.uid;
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
      switchMap(async () => {
        console.log('✅ Profil utilisateur mis à jour');
        
        // ✅ Si la photo a changé, mettre à jour les conversations
        if (updates.photoURL) {
          await this.updateUserPhotoInConversations(userId, updates.photoURL);
        }
      }),
      map(() => void 0)
    );
  }

  private async updateUserPhotoInConversations(userId: string, newPhotoURL: string): Promise<void> {
    const conversationsRef = collection(this.firestore, 'conversations');
    
    // Trouver toutes les conversations où l'utilisateur est participant1
    const q1 = query(conversationsRef, where('participant1Id', '==', userId));
    // Trouver toutes les conversations où l'utilisateur est participant2
    const q2 = query(conversationsRef, where('participant2Id', '==', userId));
    
    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);
    
    // Mettre à jour en batch pour optimiser
    const batch = writeBatch(this.firestore);
    
    snapshot1.forEach(docSnap => {
      batch.update(docSnap.ref, { participant1PhotoURL: newPhotoURL });
    });
    
    snapshot2.forEach(docSnap => {
      batch.update(docSnap.ref, { participant2PhotoURL: newPhotoURL });
    });
    
    if (snapshot1.size > 0 || snapshot2.size > 0) {
      await batch.commit();
      console.log(`✅ Photo mise à jour dans ${snapshot1.size + snapshot2.size} conversations`);
    }
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
   * NOUVEAU : Upload plusieurs photos vers la galerie
   * Limite : 6 photos maximum par utilisateur
   * 
   * @param files - Fichiers images à uploader
   * @param userId - UID Firebase de l'utilisateur
   * @returns Promise<string[]> - URLs des photos uploadées
   */
  async uploadMultiplePhotos(files: File[], userId: string): Promise<string[]> {
    console.log(`📸 Upload de ${files.length} photos pour:`, userId);

    if (files.length > 6) {
      throw new Error('Maximum 6 photos autorisées');
    }

    const uploadPromises = files.map(async (file, index) => {
      const timestamp = Date.now();
      const fileName = `${userId}_gallery_${timestamp}_${index}.jpg`;
      const filePath = `${this.galleryFolder}/${fileName}`;
      
      const storageRef = ref(this.storage, filePath);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    });

    try {
      const urls = await Promise.all(uploadPromises);
      console.log(`✅ ${urls.length} photos uploadées`);
      return urls;
    } catch (error) {
      console.error('❌ Erreur upload photos:', error);
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
    const usersCollection = collection(this.firestore, 'users'); // ✅ ICI
    const userDocRef = doc(usersCollection, userId);

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
  // 🏆 SYSTÈME DE BADGES (NOUVEAU)
  // ========================================

  /**
   * NOUVEAU : Calcule et retourne les badges d'un utilisateur
   * Basé sur les critères d'obtention définis
   * 
   * @param user - Profil utilisateur
   * @returns UserBadge[] - Liste des badges obtenus
   */
  getUserBadges(user: User): UserBadge[] {
    const badges: UserBadge[] = [];

    // Badge : Email vérifié
    if (user.isEmailVerified) {
      badges.push({
        type: BadgeType.EMAIL_VERIFIED,
        label: 'Email vérifié',
        icon: 'checkmark-circle',
        color: 'success',
        description: 'Adresse email vérifiée'
      });
    }

    // Badge : Profil complet
    const completion = this.calculateProfileCompletion(user);
    if (completion.percentage === 100) {
      badges.push({
        type: BadgeType.PROFILE_COMPLETE,
        label: 'Profil complet',
        icon: 'star',
        color: 'warning',
        description: 'Profil 100% complété'
      });
    }

    // Badge : Nouveau membre (moins de 7 jours)
    const accountAge = Date.now() - user.createdAt.toMillis();
    const daysOld = accountAge / (1000 * 60 * 60 * 24);
    if (daysOld <= 7) {
      badges.push({
        type: BadgeType.NEW_MEMBER,
        label: 'Nouveau',
        icon: 'sparkles',
        color: 'tertiary',
        description: 'Membre depuis moins de 7 jours'
      });
    }

    // Badge : Organisateur actif (3+ événements créés)
    if (user.eventsCreatedCount >= 3 && user.eventsCreatedCount < 10) {
      badges.push({
        type: BadgeType.ACTIVE_ORGANIZER,
        label: 'Organisateur actif',
        icon: 'calendar',
        color: 'primary',
        description: '3+ événements organisés'
      });
    }

    // Badge : Super organisateur (10+ événements créés)
    if (user.eventsCreatedCount >= 10) {
      badges.push({
        type: BadgeType.SUPER_ORGANIZER,
        label: 'Super organisateur',
        icon: 'trophy',
        color: 'warning',
        description: '10+ événements organisés'
      });
    }

    // Badge : Participant actif (5+ participations)
    if (user.eventsJoinedCount >= 5 && user.eventsJoinedCount < 20) {
      badges.push({
        type: BadgeType.ACTIVE_PARTICIPANT,
        label: 'Participant actif',
        icon: 'people',
        color: 'secondary',
        description: '5+ participations'
      });
    }

    // Badge : Super participant (20+ participations)
    if (user.eventsJoinedCount >= 20) {
      badges.push({
        type: BadgeType.SUPER_PARTICIPANT,
        label: 'Super participant',
        icon: 'medal',
        color: 'warning',
        description: '20+ participations'
      });
    }

    return badges;
  }

  // ========================================
  // 📊 PROGRESSION DU PROFIL (NOUVEAU)
  // ========================================

  /**
   * NOUVEAU : Calcule le pourcentage de complétude du profil
   * Utilisé pour la barre de progression
   * 
   * @param user - Profil utilisateur
   * @returns ProfileCompletionStatus - Statut de complétude
   */
  calculateProfileCompletion(user: User): ProfileCompletionStatus {
    const fields = {
      photoURL: !!user.photoURL,
      bio: !!user.bio && user.bio.length >= 10,
      dateOfBirth: !!user.dateOfBirth,
      phoneNumber: !!user.phoneNumber,
      city: !!user.city,
      interests: (user.interests?.length || 0) >= 3,
      musicStyles: (user.musicStyles?.length || 0) >= 2,  // Au moins 2 styles
      profilePhotos: (user.profilePhotos?.length || 0) >= 3  // Au moins 3 photos sur 6
    };

    const completedFields: string[] = [];
    const missingFields: string[] = [];

    Object.entries(fields).forEach(([key, value]) => {
      if (value) {
        completedFields.push(key);
      } else {
        missingFields.push(key);
      }
    });

    const totalFields = Object.keys(fields).length;
    const completedCount = completedFields.length;
    const percentage = Math.round((completedCount / totalFields) * 100);

    return {
      percentage,
      completedFields,
      missingFields,
      totalFields,
      completedCount
    };
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
    return user(this.auth).pipe(
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
    const usersRef = collection(this.firestore, this.usersCollection);
    console.log('🔍 Recherche utilisateurs:', searchQuery);
    
    // Recherche simple par displayName (Firebase ne supporte pas le full-text search)
    // Pour une recherche avancée, utiliser Algolia ou ElasticSearch
    const q = query(
      usersRef,
      where('displayName', '>=', searchQuery),
      where('displayName', '<=', searchQuery + '\uf8ff')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User));
        console.log(`✅ ${users.length} utilisateurs trouvés`);
        return users;
      })
    );
  }
}






