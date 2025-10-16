// src/app/core/services/authentication.service.ts
// Service de gestion de l'authentification Firebase

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
  onAuthStateChanged
} from '@angular/fire/auth';
import { from, Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  // Injection du service Auth de Firebase
  private readonly auth = inject(Auth);
  
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
  
  /**
   * Inscription avec email et mot de passe
   * @param email Email de l'utilisateur
   * @param password Mot de passe
   * @param displayName Nom d'affichage
   */
  signup(email: string, password: string, displayName: string): Observable<UserCredential> {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      tap(async (credential) => {
        // Mise à jour du profil avec le nom d'affichage
        if (credential.user) {
          await updateProfile(credential.user, { displayName });
          console.log('✅ Inscription réussie:', email);
        }
      })
    );
  }
  
  /**
   * Connexion avec email et mot de passe
   * @param email Email de l'utilisateur
   * @param password Mot de passe
   */
  login(email: string, password: string): Observable<UserCredential> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      tap(() => console.log('✅ Connexion réussie:', email))
    );
  }
  
  /**
   * Connexion avec Google
   */
  signInWithGoogle(): Observable<UserCredential> {
    const provider = new GoogleAuthProvider();
    // Demande l'accès au profil et email
    provider.addScope('profile');
    provider.addScope('email');
    
    return from(signInWithPopup(this.auth, provider)).pipe(
      tap((credential) => {
        console.log('✅ Connexion Google réussie:', credential.user.email);
      })
    );
  }
  
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
      tap(() => console.log('📧 Email de réinitialisation envoyé à:', email))
    );
  }
  
  /**
   * Met à jour le profil de l'utilisateur
   * @param displayName Nouveau nom d'affichage
   * @param photoURL Nouvelle URL de photo
   */
  updateUserProfile(displayName?: string, photoURL?: string): Observable<void> {
    if (!this.auth.currentUser) {
      throw new Error('Aucun utilisateur connecté');
    }
    
    return from(
      updateProfile(this.auth.currentUser, {
        displayName: displayName || this.auth.currentUser.displayName,
        photoURL: photoURL || this.auth.currentUser.photoURL
      })
    ).pipe(
      tap(() => console.log('✅ Profil mis à jour'))
    );
  }
}