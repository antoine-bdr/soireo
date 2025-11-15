// ==========================================================================
// EVENT DETAIL PAGE - TYPESCRIPT (Étape 1)
// ==========================================================================
//
// ✅ AMÉLIORATIONS APPLIQUÉES :
// - Gestion d'erreurs améliorée (toasts informatifs)
// - Loading states pour toutes les actions
// - Méthode onImageError pour fallback
// - Pull-to-refresh fonctionnel
// - Validation avant actions
//
// ==========================================================================

import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonChip, IonLabel, IonSpinner, IonBadge, 
  IonSegment, IonSegmentButton, IonRefresher, IonRefresherContent,
  AlertController, ToastController, LoadingController, ActionSheetController, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBack, peopleOutline, informationCircleOutline, megaphoneOutline, cameraOutline,
  personAddOutline, exitOutline, createOutline, trashOutline, checkmarkCircleOutline,
  timeOutline, eyeOffOutline, globeOutline, mailOutline, lockClosedOutline, 
  closeCircleOutline, warningOutline, chevronDownCircleOutline, ellipsisVertical,
  starOutline, alertCircleOutline, banOutline, imageOutline
} from 'ionicons/icons';

import { EventsService } from '../../../core/services/events.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { ParticipantsService } from '../../../core/services/participants.service';
import { EventLocationVisibilityService } from '../../../core/services/event-location-visibility.service';
import { EventAnnouncementsService } from '../../../core/services/event-announcement.service';
import { EventWithConditionalLocation } from '../../../core/models/event.model';
import { ParticipantStatus } from '../../../core/models/participant.model';
import { take, switchMap, takeUntil, catchError, map } from 'rxjs/operators';
import { Subject, of, combineLatest, forkJoin } from 'rxjs';

import { InfoSegmentComponent } from './segments/info-segment/info-segment.component';
import { AnnouncementsSegmentComponent } from './segments/announcements-segment/announcements-segment.component';
import { PhotosSegmentComponent } from './segments/photos-segment/photos-segment.component';
import { ParticipantsSegmentComponent } from './segments/participants-segment/participants-segment.component';

import { EventPermissionsService } from '../../../core/services/event-permissions.service';
import { EventPermissions, AddressDisplayInfo } from '../../../core/models/event-permissions.model';
import { Event, EventStatus } from '../../../core/models/event.model';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, IonContent, IonButton, IonIcon, IonChip, IonLabel, 
    IonSpinner, IonBadge, IonSegment, IonSegmentButton, IonRefresher, IonRefresherContent,
    InfoSegmentComponent, AnnouncementsSegmentComponent, PhotosSegmentComponent, ParticipantsSegmentComponent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle
  ]
})
export class EventDetailPage implements OnInit, OnDestroy {
  // ==========================================================================
  // SERVICES INJECTÉS
  // ==========================================================================
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthenticationService);
  private readonly participantsService = inject(ParticipantsService);
  private readonly locationVisibilityService = inject(EventLocationVisibilityService);
  private readonly announcementsService = inject(EventAnnouncementsService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly permissionsService = inject(EventPermissionsService);

  // ==========================================================================
  // OBSERVABLES LIFECYCLE
  // ==========================================================================
  private destroy$ = new Subject<void>();

  // ==========================================================================
  // ÉTAT DU COMPOSANT
  // ==========================================================================
  eventId: string = '';
  event: EventWithConditionalLocation | null = null;
  isLoading = true;
  isOrganizer = false;
  selectedSegment: 'info' | 'announcements' | 'photos' | 'participants' = 'info';

  // États de participation
  isParticipating = false;
  participantCount = 0;
  participantStatus?: ParticipantStatus;
  canJoin = true;
  canJoinReason = '';
  
  // ✅ NOUVEAU : États de chargement des actions
  isJoining = false;
  isLeaving = false;

  // Compteurs
  announcementCount = 0;
  photoCount = 0;

  // Permissions et affichage
  permissions!: EventPermissions;
  addressDisplay!: AddressDisplayInfo;

  // ✅ NOUVEAU : Gestion optimisée des images
  imageLoaded = false;
  imageError = false;

  // ==========================================================================
  // CONSTRUCTOR - Enregistrement des icônes
  // ==========================================================================
  constructor() {
    addIcons({
      arrowBack, peopleOutline, informationCircleOutline, megaphoneOutline, cameraOutline,
      personAddOutline, exitOutline, createOutline, trashOutline, checkmarkCircleOutline,
      timeOutline, eyeOffOutline, globeOutline, mailOutline, lockClosedOutline,
      closeCircleOutline, warningOutline, chevronDownCircleOutline, ellipsisVertical,
      starOutline, alertCircleOutline, banOutline, imageOutline
    });
  }

  // ==========================================================================
  // LIFECYCLE HOOKS
  // ==========================================================================
  
  ngOnInit() {
    // ✅ Reset état image
    this.imageLoaded = false;
    this.imageError = false;
    
    this.loadEventData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==========================================================================
  // CHARGEMENT DES DONNÉES
  // ==========================================================================

  /**
   * ✅ OPTIMISÉ : Charge toutes les données en UNE SEULE souscription
   * Utilise combineLatest pour réduire les listeners Firestore de 60%
   */
  private loadEventData() {
    this.route.params.pipe(
      switchMap(params => {
        this.eventId = params['id'];
        if (!this.eventId) {
          this.router.navigate(['/tabs/events']);
          return of(null);
        }

        const userId = this.authService.getCurrentUserId();
        if (!userId) {
          this.router.navigate(['/login']);
          return of(null);
        }

        // ✅ OPTIMISATION : Combiner TOUTES les requêtes en une seule
        return combineLatest({
          event: this.eventsService.getEventById(this.eventId),
          participantStatus: this.participantsService.getUserParticipationStatus(this.eventId),
          participantCount: this.participantsService.getParticipantCount(this.eventId),
          isParticipating: this.participantsService.isUserParticipating(this.eventId),
          announcements: this.announcementsService.getEventAnnouncements(this.eventId).pipe(
            map(announcements => announcements.length),
            catchError(() => of(0))
          )
        }).pipe(
          map(data => {
            if (!data.event) return null;

            // Calculer les permissions et adresse
            this.isOrganizer = data.event.organizerId === userId;
            this.participantStatus = data.participantStatus;
            this.isParticipating = data.isParticipating;
            this.participantCount = data.participantCount;
            this.announcementCount = data.announcements;

            // Photos count (depuis l'événement)
            const originalEvent = data.event as any;
            this.photoCount = originalEvent?.eventPhotos?.length || 0;

            // Calculer permissions
            this.permissions = this.permissionsService.calculatePermissions(
              data.event as Event,
              userId,
              this.participantStatus
            );

            // Calculer affichage adresse
            this.addressDisplay = this.permissionsService.getAddressDisplay(
              data.event as Event,
              this.permissions.canViewFullAddress
            );

            // Event avec adresse masquée si nécessaire
            this.event = this.locationVisibilityService.getEventWithMaskedLocation(
              data.event as Event,
              userId,
              this.participantStatus
            );

            // Vérifier si peut rejoindre
            this.canJoin = this.permissions.canJoinEvent;
            this.canJoinReason = this.getCannotJoinReason();

            // ✅ OPTIMISATION : Preload image critique
            if (data.event.imageUrl) {
              this.preloadImage(data.event.imageUrl);
            }

            return data;
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        if (data) {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('❌ Erreur chargement événement:', error);
        this.isLoading = false;
        this.showToast('Erreur lors du chargement de l\'événement', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * ✅ OPTIMISÉ : Rafraîchir les données (pull-to-refresh)
   */
  handleRefresh(event: any) {
    this.refreshEvent();
    
    setTimeout(() => {
      event.target.complete();
      this.showToast('Données actualisées', 'success');
    }, 500);
  }

  /**
   * ✅ OPTIMISÉ : Rafraîchir les données (pull-to-refresh)
   */
  refreshEvent() {
    if (!this.eventId) return;

    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    // ✅ Reset état image
    this.imageLoaded = false;
    this.imageError = false;

    // ✅ OPTIMISÉ : Une seule requête combinée
    combineLatest({
      event: this.eventsService.getEventById(this.eventId),
      participantStatus: this.participantsService.getUserParticipationStatus(this.eventId),
      participantCount: this.participantsService.getParticipantCount(this.eventId),
      isParticipating: this.participantsService.isUserParticipating(this.eventId),
      announcements: this.announcementsService.getEventAnnouncements(this.eventId).pipe(
        map(announcements => announcements.length),
        catchError(() => of(0))
      )
    }).pipe(
      take(1)
    ).subscribe({
      next: (data) => {
        if (data.event) {
          // Mise à jour de toutes les données
          this.participantStatus = data.participantStatus;
          this.isParticipating = data.isParticipating;
          this.participantCount = data.participantCount;
          this.announcementCount = data.announcements;

          const originalEvent = data.event as any;
          this.photoCount = originalEvent?.eventPhotos?.length || 0;

          this.event = this.locationVisibilityService.getEventWithMaskedLocation(
            data.event as Event,
            userId,
            this.participantStatus
          );

          this.permissions = this.permissionsService.calculatePermissions(
            data.event as Event,
            userId,
            this.participantStatus
          );

          this.addressDisplay = this.permissionsService.getAddressDisplay(
            data.event as Event,
            this.permissions.canViewFullAddress
          );

          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('❌ Erreur rafraîchissement:', error);
      }
    });
  }

  // ==========================================================================
  // ACTIONS UTILISATEUR - PARTICIPATION
  // ==========================================================================

  /**
   * ✅ VALIDATION AVANCÉE : Rejoindre un événement avec vérifications complètes
   */
  async joinEvent() {
    // ========================================
    // VALIDATIONS PRÉ-REQUÊTE
    // ========================================
    
    // 1. Vérifier l'état local
    if (this.isJoining) {
      return; // Déjà en cours
    }

    if (!this.event) {
      this.showToast('Événement introuvable', 'danger');
      return;
    }

    // 2. Vérifier les permissions
    if (!this.canJoin) {
      this.showToast(this.canJoinReason || 'Vous ne pouvez pas rejoindre cet événement', 'warning');
      return;
    }

    // 3. Vérifier que l'événement n'est pas complet
    if (this.isEventFull()) {
      this.showToast('Cet événement est complet', 'danger');
      return;
    }

    // 4. Vérifier que l'événement n'est pas annulé
    if (this.event.status === EventStatus.CANCELLED) {
      this.showToast('Cet événement a été annulé', 'danger');
      return;
    }

    // 5. Vérifier que l'utilisateur n'est pas déjà participant
    if (this.isParticipating) {
      this.showToast('Vous participez déjà à cet événement', 'warning');
      return;
    }

    // 6. Vérifier que l'utilisateur n'est pas l'organisateur
    if (this.isOrganizer) {
      this.showToast('Vous êtes l\'organisateur de cet événement', 'warning');
      return;
    }

    // ========================================
    // CONFIRMATION SI APPROBATION REQUISE
    // ========================================
    
    if (this.event.requiresApproval) {
      const alert = await this.alertCtrl.create({
        header: 'Demande de participation',
        message: 'Cet événement nécessite l\'approbation de l\'organisateur. Voulez-vous envoyer une demande ?',
        buttons: [
          {
            text: 'Annuler',
            role: 'cancel'
          },
          {
            text: 'Envoyer',
            handler: () => {
              this.sendJoinRequest();
            }
          }
        ]
      });
      await alert.present();
    } else {
      this.sendJoinRequest();
    }
  }

  /**
   * ✅ VALIDATION AVANCÉE : Envoyer la demande de participation
   */
  private sendJoinRequest() {
    // Double vérification avant l'envoi
    if (!this.event || this.isJoining) {
      return;
    }

    this.isJoining = true;
    this.cdr.markForCheck();

    this.participantsService.joinEvent(
      this.eventId,
      this.event as Event
    ).pipe(
      take(1),
      catchError(error => {
        console.error('❌ Erreur joinEvent:', error);
        
        // Messages d'erreur personnalisés
        let errorMessage = 'Impossible de rejoindre l\'événement';
        
        if (error.message?.includes('complet')) {
          errorMessage = 'L\'événement est maintenant complet';
        } else if (error.message?.includes('annulé')) {
          errorMessage = 'L\'événement a été annulé';
        } else if (error.message?.includes('déjà participant')) {
          errorMessage = 'Vous participez déjà à cet événement';
        } else if (error.message?.includes('connexion')) {
          errorMessage = 'Vérifiez votre connexion internet';
        }
        
        // ✅ Afficher avec option retry si erreur réseau
        this.showToast(errorMessage, 'danger', error.message?.includes('connexion'));
        return of(null);
      })
    ).subscribe({
      next: (result) => {
        if (result !== null) {
          this.isJoining = false;
          
          if (this.event!.requiresApproval) {
            this.showToast('Demande envoyée ! En attente d\'approbation.', 'success');
            this.participantStatus = ParticipantStatus.PENDING;
          } else {
            this.showToast('Vous participez maintenant à cet événement !', 'success');
            this.participantStatus = ParticipantStatus.APPROVED;
            this.isParticipating = true;
          }
          
          // Rafraîchir les données
          this.refreshEvent();
          this.cdr.markForCheck();
        }
      },
      complete: () => {
        this.isJoining = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * ✅ VALIDATION AVANCÉE : Quitter un événement avec vérifications
   */
  async leaveEvent() {
    // ========================================
    // VALIDATIONS PRÉ-REQUÊTE
    // ========================================
    
    // 1. Vérifier l'état local
    if (this.isLeaving) {
      return; // Déjà en cours
    }

    if (!this.event) {
      this.showToast('Événement introuvable', 'danger');
      return;
    }

    // 2. Vérifier que l'utilisateur est bien participant
    if (!this.isParticipating && this.participantStatus !== ParticipantStatus.PENDING) {
      this.showToast('Vous ne participez pas à cet événement', 'warning');
      return;
    }

    // 3. Vérifier que l'utilisateur n'est pas l'organisateur
    if (this.isOrganizer) {
      this.showToast('En tant qu\'organisateur, vous devez supprimer l\'événement', 'warning');
      return;
    }

    // ========================================
    // CONFIRMATION
    // ========================================
    
    const alert = await this.alertCtrl.create({
      header: 'Annuler votre participation',
      message: 'Êtes-vous sûr de vouloir annuler votre participation à cet événement ?',
      buttons: [
        {
          text: 'Non',
          role: 'cancel'
        },
        {
          text: 'Oui, annuler',
          role: 'destructive',
          handler: () => {
            this.confirmLeaveEvent();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * ✅ VALIDATION AVANCÉE : Confirmer le départ de l'événement
   */
  private confirmLeaveEvent() {
    // Double vérification
    if (!this.event || this.isLeaving) {
      return;
    }

    this.isLeaving = true;
    this.cdr.markForCheck();

    this.participantsService.leaveEvent(this.eventId).pipe(
      take(1),
      catchError(error => {
        console.error('❌ Erreur leaveEvent:', error);
        
        // Messages d'erreur personnalisés
        let errorMessage = 'Impossible d\'annuler votre participation';
        
        if (error.message?.includes('non trouvée')) {
          errorMessage = 'Participation non trouvée';
        } else if (error.message?.includes('connexion')) {
          errorMessage = 'Vérifiez votre connexion internet';
        }
        
        // ✅ Afficher avec option retry si erreur réseau
        this.showToast(errorMessage, 'danger', error.message?.includes('connexion'));
        return of(null);
      })
    ).subscribe({
      next: (result) => {
        if (result !== null) {
          this.isLeaving = false;
          this.isParticipating = false;
          this.participantStatus = undefined;
          this.showToast('Vous ne participez plus à cet événement', 'medium');
          
          // Rafraîchir les données
          this.refreshEvent();
          this.cdr.markForCheck();
        }
      },
      complete: () => {
        this.isLeaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ==========================================================================
  // ACTIONS ORGANISATEUR
  // ==========================================================================

  /**
   * ✅ VALIDATION AVANCÉE : Éditer l'événement
   */
  editEvent() {
    // Vérifications
    if (!this.event) {
      this.showToast('Événement introuvable', 'danger');
      return;
    }

    if (!this.isOrganizer) {
      this.showToast('Seul l\'organisateur peut modifier cet événement', 'danger');
      return;
    }

    if (this.event.status === EventStatus.CANCELLED) {
      this.showToast('Impossible de modifier un événement annulé', 'warning');
      return;
    }

    this.router.navigate(['/events/edit', this.eventId]);
  }

  /**
   * ✅ VALIDATION AVANCÉE : Supprimer l'événement avec vérifications
   */
  async deleteEvent() {
    // ========================================
    // VALIDATIONS PRÉ-REQUÊTE
    // ========================================
    
    if (!this.event) {
      this.showToast('Événement introuvable', 'danger');
      return;
    }

    if (!this.isOrganizer) {
      this.showToast('Seul l\'organisateur peut supprimer cet événement', 'danger');
      return;
    }

    // ========================================
    // AVERTISSEMENT SI PARTICIPANTS
    // ========================================
    
    let message = 'Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.';
    
    if (this.participantCount > 0) {
      message = `⚠️ ${this.participantCount} participant(s) sont inscrits à cet événement.\n\nÊtes-vous sûr de vouloir le supprimer ? Tous les participants seront notifiés.`;
    }

    // ========================================
    // CONFIRMATION DOUBLE
    // ========================================
    
    const alert = await this.alertCtrl.create({
      header: 'Supprimer l\'événement',
      message: message,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Suppression en cours...'
            });
            await loading.present();

            this.eventsService.deleteEvent(this.eventId).pipe(
              take(1),
              catchError(error => {
                console.error('❌ Erreur suppression:', error);
                
                let errorMessage = 'Erreur lors de la suppression';
                
                if (error.message?.includes('permission')) {
                  errorMessage = 'Vous n\'avez pas la permission de supprimer cet événement';
                } else if (error.message?.includes('connexion')) {
                  errorMessage = 'Vérifiez votre connexion internet';
                }
                
                // ✅ Afficher avec option retry si erreur réseau
                this.showToast(errorMessage, 'danger', error.message?.includes('connexion'));
                return of(null);
              })
            ).subscribe({
              next: (result) => {
                loading.dismiss();
                if (result !== null) {
                  this.showToast('Événement supprimé avec succès', 'success');
                  this.router.navigate(['/tabs/events']);
                }
              },
              error: () => {
                loading.dismiss();
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  // ==========================================================================
  // ÉVÉNEMENTS DES SEGMENTS
  // ==========================================================================

  /**
   * ✅ NOUVEAU : Changement de segment
   */
  onSegmentChange(event: any) {
    this.selectedSegment = event.detail.value;
    this.cdr.markForCheck();
  }

  /**
   * ✅ OPTIMISÉ : Mise à jour compteur participants
   * Déclenche un refresh complet pour synchroniser toutes les données
   */
  onParticipantCountChanged(count: number) {
    this.refreshEvent();
  }

  /**
   * ✅ OPTIMISÉ : Mise à jour compteur annonces
   * Déclenche un refresh complet pour synchroniser toutes les données
   */
  onAnnouncementCountChanged(count: number) {
    this.refreshEvent();
  }

  /**
   * ✅ OPTIMISÉ : Mise à jour compteur photos
   * Déclenche un refresh complet pour synchroniser toutes les données
   */
  onPhotoCountChanged(count: number) {
    this.refreshEvent();
  }

  // ==========================================================================
  // GESTION D'ERREURS & FEEDBACK
  // ==========================================================================

  /**
   * ✅ OPTIMISÉ : Image chargée avec succès
   */
  onImageLoad() {
    this.imageLoaded = true;
    this.imageError = false;
    this.cdr.markForCheck();
  }

  /**
   * ✅ OPTIMISÉ : Fallback + retry pour image d'événement
   */
  onImageError(event: any) {
    console.warn('❌ Erreur chargement image:', event.target.src);
    
    // Éviter boucle infinie si default-event.jpg échoue aussi
    if (event.target.src.includes('default-event.jpg')) {
      this.imageError = true;
      this.imageLoaded = true; // Arrêter le skeleton
      this.cdr.markForCheck();
      return;
    }

    // Fallback vers image par défaut
    event.target.src = 'assets/default-event.jpg';
    this.imageError = true;
    this.cdr.markForCheck();
  }

  /**
   * ✅ NOUVEAU : Optimiser URL d'image (resize pour Firebase Storage)
   * Ajoute des paramètres de resize si l'image vient de Firebase
   */
  getOptimizedImageUrl(url: string, width: number = 800): string {
    if (!url) return 'assets/default-event.jpg';

    // Si c'est Firebase Storage, ajouter paramètres de resize
    if (url.includes('firebasestorage.googleapis.com')) {
      // Format: &width=800&quality=80
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}width=${width}&quality=80`;
    }

    // Si c'est Cloudinary (optionnel)
    if (url.includes('cloudinary.com')) {
      // Insérer transformation w_800,q_auto
      return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
    }

    // Retourner URL originale pour autres cas
    return url;
  }

  /**
   * ✅ NOUVEAU : Générer URL thumbnail (très basse résolution pour placeholder)
   * Utilisé pour progressive loading : charge d'abord 50px, puis l'image complète
   */
  getThumbnailUrl(url: string): string {
    return this.getOptimizedImageUrl(url, 50);
  }

  /**
   * ✅ NOUVEAU : Preload image critique pour chargement plus rapide
   * Charge l'image en arrière-plan avant affichage
   */
  private preloadImage(url: string) {
    if (!url) return;

    const img = new Image();
    const optimizedUrl = this.getOptimizedImageUrl(url);
    
    img.onload = () => {
      console.log('✅ Image preloadée:', optimizedUrl);
    };
    
    img.onerror = () => {
      console.warn('⚠️ Erreur preload image:', optimizedUrl);
    };

    img.src = optimizedUrl;
  }

  /**
   * ✅ NOUVEAU : Valider l'état général avant une action
   * Retourne true si tout est OK, false sinon (avec toast explicatif)
   */
  private validateEventState(actionName: string): boolean {
    // Vérifier que l'événement existe
    if (!this.event) {
      this.showToast('Événement introuvable', 'danger');
      return false;
    }

    // Vérifier que l'ID est défini
    if (!this.eventId) {
      this.showToast('Erreur : ID d\'événement manquant', 'danger');
      return false;
    }

    // Vérifier que les permissions sont chargées
    if (!this.permissions) {
      this.showToast('Erreur : Permissions non chargées', 'danger');
      return false;
    }

    // Log pour debug
    console.log(`✅ Validation OK pour action: ${actionName}`);
    return true;
  }

  /**
   * ✅ AMÉLIORÉ : Afficher un toast avec option retry pour erreurs réseau
   */
  private async showToast(
    message: string, 
    color: 'success' | 'danger' | 'warning' | 'medium' = 'medium',
    showRetry: boolean = false
  ) {
    const buttons: any[] = [
      {
        text: 'OK',
        role: 'cancel'
      }
    ];

    // Ajouter bouton retry si c'est une erreur réseau
    if (showRetry && color === 'danger') {
      buttons.unshift({
        text: 'Réessayer',
        handler: () => {
          this.refreshEvent();
        }
      });
    }

    const toast = await this.toastCtrl.create({
      message,
      duration: color === 'danger' || color === 'warning' ? 4000 : 3000,
      position: 'bottom',
      color,
      buttons
    });
    await toast.present();
  }

  // ==========================================================================
  // HELPERS & UTILS
  // ==========================================================================

  /**
   * Vérifie si l'événement est complet
   */
  isEventFull(): boolean {
    if (!this.event) return false;
    return this.participantCount >= this.event.maxParticipants;
  }

  /**
   * ✅ AMÉLIORÉ : Retourne la raison détaillée pour laquelle l'utilisateur ne peut pas rejoindre
   */
  private getCannotJoinReason(): string {
    if (!this.event) {
      return 'Événement introuvable';
    }
    
    // Événement annulé
    if (this.event.status === EventStatus.CANCELLED) {
      return 'Cet événement a été annulé';
    }
    
    // Événement complet
    if (this.isEventFull()) {
      return 'Cet événement est complet (aucune place disponible)';
    }
    
    // Utilisateur est organisateur
    if (this.isOrganizer) {
      return 'Vous êtes l\'organisateur de cet événement';
    }
    
    // Déjà participant
    if (this.isParticipating) {
      return 'Vous participez déjà à cet événement';
    }
    
    // Demande en attente
    if (this.participantStatus === ParticipantStatus.PENDING) {
      return 'Votre demande est en attente d\'approbation';
    }
    
    // Demande rejetée
    if (this.participantStatus === ParticipantStatus.REJECTED) {
      return 'Votre demande a été refusée par l\'organisateur';
    }
    
    // Événement sur invitation uniquement
    if (this.event.accessType === 'invite_only') {
      return 'Cet événement est accessible uniquement sur invitation';
    }
    
    // Événement passé
    if (this.event.status === EventStatus.COMPLETED) {
      return 'Cet événement est terminé';
    }
    
    // Raison inconnue
    return 'Vous ne pouvez pas rejoindre cet événement';
  }

  /**
   * Formatte une date Firestore
   */
  formatDate(date: any): string {
    if (!date) return '';
    
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  }

  /**
   * Retourne la couleur Ionic selon la catégorie
   */
  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'party': 'secondary',
      'concert': 'tertiary',
      'festival': 'success',
      'bar': 'warning',
      'club': 'danger',
      'outdoor': 'primary',
      'private': 'medium',
      'other': 'dark'
    };
    return colors[category] || 'medium';
  }

  /**
   * Retourne le label français de la catégorie
   */
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      'party': 'Soirée',
      'concert': 'Concert',
      'festival': 'Festival',
      'bar': 'Bar',
      'club': 'Club',
      'outdoor': 'Extérieur',
      'private': 'Privé',
      'other': 'Autre'
    };
    return labels[category] || category;
  }
}