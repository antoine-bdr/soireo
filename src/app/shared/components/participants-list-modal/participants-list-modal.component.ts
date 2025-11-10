import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonAvatar,
  IonLabel,
  IonSearchbar,
  ModalController,
  ActionSheetController,
  AlertController,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  ellipsisVerticalOutline,
  personOutline,
  chatbubbleOutline,
  trashOutline,
  searchOutline, star } from 'ionicons/icons';

import { Participant } from '../../../core/models/participant.model';
import { ParticipantsService } from '../../../core/services/participants.service';
import { FriendshipStatus } from '../../../core/models/friend.model';

@Component({
  selector: 'app-participants-list-modal',
  templateUrl: './participants-list-modal.component.html',
  styleUrls: ['./participants-list-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonSearchbar
  ]
})
export class ParticipantsListModal {
  @Input() participants: Participant[] = [];
  @Input() eventId!: string;
  @Input() currentUserId!: string;
  @Input() isOrganizer: boolean = false;
  @Input() organizerId?: string;
  @Input() friendshipStatuses!: Map<string, FriendshipStatus | null>;

  filteredParticipants: Participant[] = [];
  searchTerm: string = '';

  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);
  private readonly participantsService = inject(ParticipantsService);

  constructor() {
    addIcons({closeOutline,star,ellipsisVerticalOutline,searchOutline,personOutline,chatbubbleOutline,trashOutline});
  }

  ngOnInit() {
    this.filteredParticipants = [...this.participants];
  }

  /**
   * 🔍 Filtre les participants par nom
   */
  handleSearch(event: any) {
    const query = event.target.value?.toLowerCase() || '';
    this.searchTerm = query;

    if (!query) {
      this.filteredParticipants = [...this.participants];
    } else {
      this.filteredParticipants = this.participants.filter(p =>
        p.userName.toLowerCase().includes(query)
      );
    }
  }

  /**
   * ⋮ Ouvre le menu d'actions pour un participant
   */
  async openParticipantMenu(participant: Participant, event: Event) {
    event.stopPropagation();

    const isSelf = participant.userId === this.currentUserId;
    const isOrganizer = participant.userId === this.organizerId;
    const canSendMessage = this.canSendMessage(participant.userId);

    const buttons: any[] = [];

    // 👤 Voir le profil (sauf soi-même)
    if (!isSelf) {
      buttons.push({
        text: 'Voir le profil',
        icon: 'person-outline',
        handler: () => {
          this.viewProfile(participant.userId);
        }
      });
    }

    // 💬 Envoyer un message (si amis)
    if (canSendMessage) {
      buttons.push({
        text: 'Envoyer un message',
        icon: 'chatbubble-outline',
        handler: () => {
          this.sendMessage(participant.userId);
        }
      });
    }

    // 🗑️ Retirer (organisateur uniquement, pas sur soi-même ni sur l'organisateur)
    if (this.isOrganizer && !isSelf && !isOrganizer) {
      buttons.push({
        text: 'Retirer de l\'événement',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => {
          this.removeParticipant(participant);
        }
      });
    }

    // Annuler
    buttons.push({
      text: 'Annuler',
      role: 'cancel'
    });

    const actionSheet = await this.actionSheetCtrl.create({
      header: participant.userName,
      buttons
    });

    await actionSheet.present();
  }

  /**
   * 👤 Navigue vers le profil
   */
  async viewProfile(userId: string) {
    await this.dismiss();  // ✅ Fermer d'abord
    this.router.navigate(['/social/friend-profile', userId]);
  }

  /**
   * 💬 Navigue vers la messagerie
   */
  async sendMessage(userId: string) {
    await this.dismiss();  // ✅ Fermer d'abord
    this.router.navigate(['/social/messages', userId]);
  }

  /**
   * 🗑️ Retire un participant
   */
  async removeParticipant(participant: Participant) {
    const alert = await this.alertCtrl.create({
      header: 'Retirer ce participant ?',
      message: `Voulez-vous vraiment retirer ${participant.userName} de l'événement ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Retirer',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Retrait en cours...'
            });
            await loading.present();
  
            this.participantsService.leaveEvent(this.eventId, participant.userId).subscribe({
              next: async () => {
                // ✅ Retirer IMMÉDIATEMENT de la liste locale AVANT dismiss
                this.participants = this.participants.filter(p => p.userId !== participant.userId);
                this.filteredParticipants = this.filteredParticipants.filter(p => p.userId !== participant.userId);
                
                await loading.dismiss();
                
                const toast = await this.toastCtrl.create({
                  message: `${participant.userName} a été retiré`,
                  duration: 2000,
                  color: 'success'
                });
                await toast.present();
              },
              error: async (error) => {
                await loading.dismiss();
                console.error('❌ Erreur retrait:', error);
                const toast = await this.toastCtrl.create({
                  message: 'Erreur lors du retrait',
                  duration: 2000,
                  color: 'danger'
                });
                await toast.present();
              }
            });
          }
        }
      ]
    });
  
    await alert.present();
  }

  /**
   * ✅ Vérifie si peut envoyer un message
   */
  canSendMessage(userId: string): boolean {
    if (userId === this.currentUserId) return false;
    const status = this.friendshipStatuses.get(userId);
    return status === FriendshipStatus.ACCEPTED;
  }

  /**
   * 🚪 Ferme la modal
   */
  dismiss() {
    return this.modalCtrl.dismiss();
  }
}