// src/app/features/events/event-detail/components/announcements-segment/announcements-segment.component.ts
// ✅ VERSION OPTIMISÉE avec Markdown, sanitization, trackBy

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { 
  IonCard, IonCardContent, IonButton, IonIcon, IonSpinner, IonBadge, IonTextarea,
  IonFab, IonFabButton, IonList, IonItem, IonLabel, IonSelect, IonSelectOption,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  megaphoneOutline, addOutline, trashOutline, pinOutline, sendOutline, 
  closeOutline, chevronDownOutline, ellipsisVertical
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';

import { EventAnnouncement } from '../../../../../core/models/event.model';
import { EventAnnouncementsService } from '../../../../../core/services/event-announcement.service';
import { AddressDisplayInfo, EventPermissions } from 'src/app/core/models/event-permissions.model';

@Component({
  selector: 'app-announcements-segment',
  templateUrl: './announcements-segment.component.html',
  styleUrls: ['./announcements-segment.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, IonCard, IonCardContent, IonButton, IonIcon, IonSpinner, 
    IonBadge, IonTextarea, IonFab, IonFabButton, IonList, IonItem, IonLabel, 
    IonSelect, IonSelectOption
  ]
})
export class AnnouncementsSegmentComponent implements OnInit, OnDestroy {
  @Input() eventId!: string;
  @Output() announcementCountChanged = new EventEmitter<number>();

  @Input() permissions!: EventPermissions;
  @Input() isReadOnly = false;

  private readonly announcementsService = inject(EventAnnouncementsService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly sanitizer = inject(DomSanitizer);

  announcements: EventAnnouncement[] = [];
  isLoading = true;
  
  showCreateForm = false;
  newAnnouncementText = '';
  newAnnouncementType: 'info' | 'important' | 'reminder' | 'live' | 'thanks' = 'info';
  isCreating = false;

  private destroy$ = new Subject<void>();

  constructor() {
    addIcons({
      megaphoneOutline, addOutline, trashOutline, pinOutline, sendOutline, 
      closeOutline, chevronDownOutline, ellipsisVertical
    });
  }

  ngOnInit() {
    console.log('📢 AnnouncementsSegment initialized');
    this.loadAnnouncements();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAnnouncements() {
    this.isLoading = true;
    
    this.announcementsService.getEventAnnouncements(this.eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (announcements) => {
          this.announcements = announcements.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.timestamp.toMillis() - a.timestamp.toMillis();
          });
          
          this.isLoading = false;
          this.announcementCountChanged.emit(announcements.length);
          console.log(`📢 ${announcements.length} annonces chargées`);
        },
        error: (error) => {
          console.error('❌ Erreur chargement annonces:', error);
          this.isLoading = false;
        }
      });
  }

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.resetForm();
    }
  }

  async createAnnouncement() {
    if (!this.newAnnouncementText.trim()) {
      this.showToast('Le message ne peut pas être vide', 'warning');
      return;
    }

    if (this.isCreating) return;

    this.isCreating = true;

    this.announcementsService.createAnnouncement(
      this.eventId,
      this.newAnnouncementText.trim(),
      this.newAnnouncementType
    ).subscribe({
      next: () => {
        this.showToast('Annonce publiée !', 'success');
        this.resetForm();
        this.showCreateForm = false;
        this.isCreating = false;
      },
      error: (error) => {
        console.error('❌ Erreur création annonce:', error);
        this.showToast('Erreur lors de la publication', 'danger');
        this.isCreating = false;
      }
    });
  }

  async deleteAnnouncement(announcement: EventAnnouncement) {
    if (!announcement.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Supprimer l\'annonce',
      message: 'Êtes-vous sûr de vouloir supprimer cette annonce ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => this.confirmDelete(announcement.id!)
        }
      ]
    });

    await alert.present();
  }

  private confirmDelete(announcementId: string) {
    this.announcementsService.deleteAnnouncement(announcementId).subscribe({
      next: () => {
        this.showToast('Annonce supprimée', 'success');
      },
      error: (error) => {
        console.error('❌ Erreur suppression:', error);
        this.showToast('Erreur lors de la suppression', 'danger');
      }
    });
  }

  async togglePin(announcement: EventAnnouncement) {
    if (!announcement.id) return;

    const newPinnedState = !announcement.isPinned;

    this.announcementsService.togglePin(announcement.id, newPinnedState).subscribe({
      next: () => {
        const message = newPinnedState ? 'Annonce épinglée' : 'Annonce désépinglée';
        this.showToast(message, 'success');
      },
      error: (error) => {
        console.error('❌ Erreur toggle pin:', error);
        this.showToast('Erreur lors de l\'action', 'danger');
      }
    });
  }

  private resetForm() {
    this.newAnnouncementText = '';
    this.newAnnouncementType = 'info';
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'info': 'Info',
      'important': 'Important',
      'reminder': 'Rappel',
      'live': 'En direct',
      'thanks': 'Remerciements'
    };
    return labels[type] || type;
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'info': '📢',
      'important': '⚠️',
      'reminder': '⏰',
      'live': '🔴',
      'thanks': '🙏'
    };
    return icons[type] || '📢';
  }

  // ✅ Formatage avec support emojis et line breaks
  formatMessage(message: string): SafeHtml {
    if (!message) return '';
    
    // Convertir les line breaks en <br>
    let formatted = message.replace(/\n/g, '<br>');
    
    // Détecter les URLs et les rendre cliquables
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Sanitize pour éviter XSS
    return this.sanitizer.sanitize(1, formatted) || ''; // 1 = SecurityContext.HTML
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'Date inconnue';
    
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      if (diffDays === 1) return 'Hier';
      if (diffDays < 7) return `Il y a ${diffDays} jours`;
      
      return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Erreur formatage date:', error);
      return 'Date inconnue';
    }
  }

  // ✅ TrackBy pour optimisation
  trackById(index: number, announcement: EventAnnouncement): string {
    return announcement.id || index.toString();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  get canCreateAnnouncement(): boolean {
    return this.permissions?.canCreateAnnouncement && !this.isReadOnly;
  }
}