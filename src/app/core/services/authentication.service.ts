// src/app/core/services/authentication.service.ts
// Service de gestion de l'authentification Firebase
// ✅ MODIFIÉ : Intégration automatique profil Firestore (Sprint 4)

import { Injectable, inject, signal } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
  user,
  UserCredential,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged
} from '@angular/fire/auth';
import { from, Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { map, tap, switchMap, catchError } from 'rxjs/operators';
import { UsersService } from './users.service';
import { CreateUserDto } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  // ========================================
  // INJECTION DES DÉPENDANCES
  // ========================================
  private readonly auth = inject(Auth);
  private readonly usersService = inject(UsersService);
  
  // Signal pour suivre l'utilisateur courant
  currentUser = signal<User | null>(null);
  
  // BehaviorSubject pour l'état d'authentification
  private authState$ = new BehaviorSubject<User | null>(null);
  
  constructor() {
    // Écoute les changements d'état d'authentification
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.set(user);
      this.authState$.next(user);
      console.log('🔐 État auth changé:', user ? user.email : 'non connecté');
    });
  }
  
  // ========================================
  // OBSERVABLES ÉTAT AUTHENTIFICATION
  // ========================================

  /**
   * Observable qui émet à chaque changement d'état d'authentification
   */
  getUser(): Observable<User | null> {
    return this.authState$.asObservable();
  }
  
  /**
   * Vérifie si l'utilisateur est connecté
   */
  isAuthenticated(): Observable<boolean> {
    return this.authState$.pipe(
      map(user => !!user)
    );
  }
  
  // ========================================
  // ✅ INSCRIPTION (MODIFIÉE)
  // ========================================

  /**
   * Inscription avec email et mot de passe
   * ✅ MODIFIÉ : Crée automatiquement le profil Firestore après Firebase Auth
   * 
   * @param email Email de l'utilisateur
   * @param password Mot de passe
   * @param displayName Nom d'affichage complet (ex: "Jean Dupont")
   * @returns Observable<UserCredential>
   */
  signup(email: string, password: string, displayName: string): Observable<UserCredential> {
    console.log('📝 Inscription démarrée pour:', email);

    return from(createUserWithEmailAndPassword(this.auth, email, password)).pipe(
      // Étape 1 : Mise à jour du profil Firebase Auth
      tap(async (credential) => {
        if (credential.user) {
          await updateProfile(credential.user, { displayName });
          console.log('✅ Profil Firebase Auth créé');
        }
      }),
      // Étape 2 : Création du profil Firestore
      switchMap((credential) => {
        // Extrait firstName et lastName du displayName
        const { firstName, lastName } = this.parseDisplayName(displayName);

        // Prépare les données pour Firestore
        const userProfile: CreateUserDto = {
          id: credential.user.uid,
          email: email,
          displayName: displayName,
          firstName: firstName,
          lastName: lastName,
          photoURL: credential.user.photoURL || undefined,
          isEmailVerified: credential.user.emailVerified
        };

        // Crée le profil Firestore
        return this.usersService.createUserProfile(userProfile).pipe(
          map(() => {
            console.log('✅ Profil Firestore créé');
            return credential;
          }),
          // ✅ NOUVEAU : Envoi de l'email de vérification
          switchMap((cred) => {
            console.log('📧 Envoi de l\'email de vérification...');
            return this.sendEmailVerification().pipe(
              tap(() => console.log('✅ Email de vérification envoyé')),
              // Retourne le credential même si l'email échoue (non bloquant)
              catchError((error) => {
                console.warn('⚠️ Erreur envoi email vérification (non bloquant):', error);
                return of(undefined);
              }),
              // Retourne toujours le credential original
              map(() => cred)
            );
          })
        );
      })
    );
  }

  // ========================================
  // ✅ CONNEXION (MODIFIÉE)
  // ========================================

  /**
   * Connexion avec email et mot de passe
   * ✅ MODIFIÉ : Met à jour lastLoginAt dans Firestore
   * 
   * @param email Email de l'utilisateur
   * @param password Mot de passe
   * @returns Observable<UserCredential>
   */
  login(email: string, password: string): Observable<UserCredential> {
    console.log('🔐 Connexion démarrée pour:', email);

    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      tap((credential) => {
        console.log('✅ Connexion Firebase Auth réussie');
        
        // Met à jour la date de dernière connexion dans Firestore
        this.usersService.updateLastLogin(credential.user.uid).subscribe({
          next: () => console.log('✅ Dernière connexion mise à jour'),
          error: (error) => console.error('⚠️ Erreur mise à jour lastLoginAt:', error)
        });
      })
    );
  }
  
  // ========================================
  // CONNEXION GOOGLE
  // ========================================

  /**
   * Connexion avec Google
   * ✅ MODIFIÉ : Crée le profil Firestore si première connexion
   */
  signInWithGoogle(): Observable<UserCredential> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    return from(signInWithPopup(this.auth, provider)).pipe(
      switchMap((credential) => {
        console.log('✅ Connexion Google réussie:', credential.user.email);

        // Vérifie si le profil Firestore existe déjà
        return this.usersService.getUserProfileOnce(credential.user.uid).pipe(
          switchMap((existingProfile) => {
            // Si le profil n'existe pas, on le crée
            if (!existingProfile) {
              console.log('🆕 Première connexion Google, création du profil Firestore');
              
              const { firstName, lastName } = this.parseDisplayName(
                credential.user.displayName || credential.user.email || 'Utilisateur'
              );

              const userProfile: CreateUserDto = {
                id: credential.user.uid,
                email: credential.user.email!,
                displayName: credential.user.displayName || credential.user.email || 'Utilisateur',
                firstName: firstName,
                lastName: lastName,
                photoURL: credential.user.photoURL || undefined,
                isEmailVerified: credential.user.emailVerified
              };

              return this.usersService.createUserProfile(userProfile).pipe(
                map(() => credential)
              );
            } else {
              // Profil existant, mise à jour lastLoginAt
              console.log('✅ Profil Firestore existant');
              this.usersService.updateLastLogin(credential.user.uid).subscribe();
              return from([credential]);
            }
          })
        );
      })
    );
  }
  
  // ========================================
  // DÉCONNEXION
  // ========================================

  /**
   * Déconnexion
   */
  logout(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      tap(() => {
        this.currentUser.set(null);
        console.log('👋 Déconnexion réussie');
      })
    );
  }
  
  // ========================================
  // UTILITAIRES
  // ========================================

  /**
   * ✅ NOUVEAU : Récupère l'utilisateur courant (objet User complet)
   */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  /**
   * Récupère l'ID de l'utilisateur courant
   */
  getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }
  
  /**
   * Récupère l'email de l'utilisateur courant
   */
  getCurrentUserEmail(): string | null {
    return this.auth.currentUser?.email || null;
  }
  
  /**
   * Récupère le nom d'affichage de l'utilisateur courant
   */
  getCurrentUserDisplayName(): string | null {
    return this.auth.currentUser?.displayName || null;
  }
  
  /**
   * Envoie un email de réinitialisation de mot de passe
   * @param email Email de l'utilisateur
   */
  resetPassword(email: string): Observable<void> {
    return from(sendPasswordResetEmail(this.auth, email)).pipe(
      tap(() => console.log('📧 Email de réinitialisation envoyé à :', email))
    );
  }
  
  /**
   * Met à jour le profil de l'utilisateur dans Firebase Auth
   * @param displayName Nouveau nom d'affichage
   * @param photoURL Nouvelle URL de photo
   */
  updateUserProfile(displayName?: string, photoURL?: string): Observable<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      throw new Error('Aucun utilisateur connecté');
    }

    return from(updateProfile(currentUser, {
      displayName: displayName || currentUser.displayName,
      photoURL: photoURL || currentUser.photoURL
    })).pipe(
      tap(() => console.log('✅ Profil Firebase Auth mis à jour'))
    );
  }

  // ========================================
  // ✅ HELPER FUNCTIONS (NOUVELLES)
  // ========================================

  /**
   * Parse un displayName pour extraire firstName et lastName
   * Exemples :
   * - "Jean Dupont" → firstName: "Jean", lastName: "Dupont"
   * - "Marie Claire Martin" → firstName: "Marie Claire", lastName: "Martin"
   * - "Jean" → firstName: "Jean", lastName: ""
   * 
   * @param displayName Nom complet
   * @returns { firstName: string, lastName: string }
   */
  private parseDisplayName(displayName: string): { firstName: string; lastName: string } {
    const trimmed = displayName.trim();
    
    // Cas : nom vide
    if (!trimmed) {
      return { firstName: 'Utilisateur', lastName: '' };
    }

    // Sépare par espace
    const parts = trimmed.split(' ');

    // Cas : un seul mot (prénom uniquement)
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }

    // Cas : plusieurs mots (prénom = tous sauf le dernier, nom = dernier)
    const lastName = parts[parts.length - 1];
    const firstName = parts.slice(0, -1).join(' ');

    return { firstName, lastName };
  }

  /**
   * Envoie un email de vérification à l'utilisateur courant
   * 
   * @returns Observable<void>
   */
  sendEmailVerification(): Observable<void> {
    const user = this.auth.currentUser;
    
    if (!user) {
      console.error('❌ Aucun utilisateur connecté');
      return throwError(() => new Error('Aucun utilisateur connecté'));
    }
  
    if (user.emailVerified) {
      console.log('✅ Email déjà vérifié');
      return of(undefined);
    }
  
    return from(
      sendEmailVerification(user, {
        // URL de redirection après vérification (optionnel)
        url: window.location.origin + '/tabs/profile',
        handleCodeInApp: false
      })
    ).pipe(
      tap(() => console.log('📧 Email de vérification envoyé à :', user.email))
    );
  }
  
  /**
   * ✅ NOUVEAU : Rafraîchit le statut de vérification de l'email
   * À appeler après que l'utilisateur ait cliqué sur le lien dans l'email
   * 
   * @returns Promise<boolean> - true si email vérifié, false sinon
   */
  async checkEmailVerified(): Promise<boolean> {
    const user = this.auth.currentUser;
    
    if (!user) {
      return false;
    }
  
    try {
      await user.reload();
      const isVerified = this.auth.currentUser?.emailVerified || false;
      console.log('🔄 Statut email vérifié:', isVerified);
      return isVerified;
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement:', error);
      return false;
    }
  }
  
  /**
   * Rafraîchit le statut de vérification de l'email (version Observable)
   * 
   * @returns Observable<boolean> - true si email vérifié, false sinon
   */
  reloadEmailVerificationStatus(): Observable<boolean> {
    const user = this.auth.currentUser;
    
    if (!user) {
      return of(false);
    }
  
    return from(user.reload()).pipe(
      map(() => {
        const isVerified = this.auth.currentUser?.emailVerified || false;
        console.log('🔄 Statut email vérifié:', isVerified);
        return isVerified;
      }),
      catchError((error) => {
        console.error('❌ Erreur lors du rafraîchissement:', error);
        return of(false);
      })
    );
  }
  
  /**
   * Vérifie si l'email de l'utilisateur courant est vérifié
   * 
   * @returns boolean
   */
  isEmailVerified(): boolean {
    return this.auth.currentUser?.emailVerified || false;
  }
}