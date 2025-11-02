// src/app/features/social/messages/messages.page.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonBackButton, IonList, IonItem, IonAvatar, IonLabel, IonBadge,
  IonSearchbar, IonRefresher, IonRefresherContent, IonSpinner, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chatbubblesOutline, searchOutline } from 'ionicons/icons';

import { MessagesService } from '../../../core/services/messages.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { UsersService } from '../../../core/services/users.service';
import { ConversationListItem } from '../../../core/models/message.model';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonBackButton, IonList, IonItem, IonAvatar, IonLabel, IonBadge,
    IonSearchbar, IonRefresher, IonRefresherContent, IonSpinner, IonIcon
  ]
})
export class MessagesPage implements OnInit {
  private readonly messagesService = inject(MessagesService);
  private readonly authService = inject(AuthenticationService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);

  // Signals
  conversations = signal<ConversationListItem[]>([]);
  filteredConversations = signal<ConversationListItem[]>([]);
  isLoading = signal(true);
  searchValue = signal('');

  constructor() {
    addIcons({ chatbubblesOutline, searchOutline });
  }

  ngOnInit() {
    this.loadConversations();
  }

  /**
   * Charge les conversations en temps réel
   */
  private loadConversations() {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;
  
    this.messagesService.getUserConversations(currentUser.uid).subscribe({
      next: async (convs) => {
        // ✅ Charger les photos à jour depuis users
        const updatedConvs = await Promise.all(
          convs.map(async (conv) => {
            const friendProfile = await this.usersService.getUserProfileOnce(conv.friendId).toPromise();
            return {
              ...conv,
              friendPhotoURL: friendProfile?.photoURL || conv.friendPhotoURL
            };
          })
        );
        
        this.conversations.set(updatedConvs);
        this.applySearchFilter();
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Erreur chargement conversations:', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Applique le filtre de recherche
   */
  private applySearchFilter() {
    const search = this.searchValue().toLowerCase().trim();
    
    if (!search) {
      this.filteredConversations.set(this.conversations());
      return;
    }

    const filtered = this.conversations().filter(conv =>
      conv.friendDisplayName.toLowerCase().includes(search) ||
      conv.lastMessageText.toLowerCase().includes(search)
    );

    this.filteredConversations.set(filtered);
  }

  /**
   * Gère le changement de recherche
   */
  onSearchChange(event: any) {
    this.searchValue.set(event.target.value || '');
    this.applySearchFilter();
  }

  /**
   * Gère le refresh
   */
  async handleRefresh(event: any) {
    this.loadConversations();
    setTimeout(() => event.target.complete(), 1000);
  }

  /**
   * Navigation vers la conversation
   */
  openConversation(conv: ConversationListItem) {
    this.router.navigate(['/social/messages', conv.friendId]);
  }

  /**
   * Formate l'heure du dernier message
   */
  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes < 1 ? 'À l\'instant' : `${minutes}min`;
    }

    if (hours < 24) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    if (hours < 48) {
      return 'Hier';
    }

    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  /**
   * Tronque le texte
   */
  truncate(text: string, maxLength: number = 60): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  /**
   * TrackBy pour optimiser *ngFor
   */
  trackByConversationId(_index: number, item: ConversationListItem): string {
    return item.conversationId;
  }
}