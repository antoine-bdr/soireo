import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonBackButton, IonAvatar, IonFooter, IonTextarea, IonIcon, IonSpinner,
  IonActionSheet, IonModal, ActionSheetController, ModalController, AlertController, IonAlert  // ✅ Ajoute ces imports
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  sendOutline, checkmarkOutline, checkmarkDoneOutline,
  imageOutline, closeCircle, arrowDownOutline  // ✅ Ajoute ces icônes
} from 'ionicons/icons';
import { Clipboard } from '@capacitor/clipboard';
import { Subscription, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { MessagesService } from '../../../core/services/messages.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { UsersService } from '../../../core/services/users.service';
import { Message, CreateMessageDto, Conversation, MessageStatus, ChatItem, transformMessagesToChatItems } from '../../../core/models/message.model';
import { User } from '../../../core/models/user.model';
import { StorageService } from '../../../core/services/storage.service';
import { ImageViewerModal } from './image-viewer-modal.component';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.page.html',
  styleUrls: ['./conversation.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonBackButton, IonAvatar, IonFooter, IonTextarea, IonIcon, IonSpinner
  ]
})
export class ConversationPage implements OnInit, OnDestroy, AfterViewInit {
  private readonly messagesService = inject(MessagesService);
  private readonly authService = inject(AuthenticationService);
  private readonly usersService = inject(UsersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly storageService = inject(StorageService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly modalCtrl = inject(ModalController)

  private readonly alertCtrl = inject(AlertController);

  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('messageInput') messageInput!: ElementRef;

  // Signals
  friendId = signal<string>('');
  friend = signal<User | null>(null);
  conversation = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  chatItems = signal<ChatItem[]>([]);  // ✅ NOUVEAU
  isLoading = signal(true);
  messageText = signal('');
  isSending = signal(false);
  friendIsTyping = signal(false);
  showScrollButton = signal(false);  // ✅ NOUVEAU
  newMessagesCount = signal(0);      // ✅ NOUVEAU

  selectedImageBlob = signal<Blob | null>(null);
  selectedImagePreview = signal<string | null>(null);
  isUploadingImage = signal(false);

  selectedMessage = signal<Message | null>(null);

  private subscriptions = new Subscription();
  private currentUserId: string = '';
  private hasScrolledInitially = false;
  private typingSubject = new Subject<boolean>();
  private typingTimeout?: any;
  private isUserScrolling = false;  // ✅ NOUVEAU

  private pressTimer: any;
  private isPressing = false;

  private touchStartX = 0;  // ✅ NOUVEAU
  private touchStartY = 0;  // ✅ NOUVEAU

  constructor() {
    addIcons({ 
      sendOutline, checkmarkOutline, checkmarkDoneOutline,
      imageOutline, closeCircle, arrowDownOutline
    });
  }

  ngOnInit() {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUserId = currentUser.uid;
    const friendIdParam = this.route.snapshot.paramMap.get('userId');

    if (!friendIdParam) {
      this.router.navigate(['/social/messages']);
      return;
    }

    this.friendId.set(friendIdParam);
    this.loadFriendData();
    this.loadOrCreateConversation();
    this.setupTypingDebounce();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.scrollToBottom(0);
      this.hasScrolledInitially = true;
    }, 500);
    
    // ✅ NOUVEAU : Observer le scroll pour le bouton
    this.setupScrollListener();
  }

  ngOnDestroy() {
    const conv = this.conversation();
    if (conv?.id) {
      this.messagesService.setTypingStatus(conv.id, this.currentUserId, false);
    }
    
    this.subscriptions.unsubscribe();
    this.typingSubject.complete();
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // ✅ NOUVEAU : Nettoyer le timer de press
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }
  }

  @HostListener('window:ionKeyboardDidShow')
  onKeyboardShow() {
    console.log('⌨️ Clavier ouvert - Scroll automatique');
    this.scrollToBottom(150);
  }

  // ========================================
  // 🔽 SCROLL TO BOTTOM BUTTON (NOUVEAU)
  // ========================================

  private setupScrollListener() {
    const content = this.content;
    if (!content) return;

    content.ionScroll.subscribe(async (event: any) => {
      const scrollElement = await content.getScrollElement();
      const scrollTop = scrollElement.scrollTop;
      const scrollHeight = scrollElement.scrollHeight;
      const clientHeight = scrollElement.clientHeight;
      
      // Afficher le bouton si on est à plus de 300px du bas
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      this.showScrollButton.set(distanceFromBottom > 300);
      
      // Si on scroll manuellement, on est en mode "user scrolling"
      this.isUserScrolling = distanceFromBottom > 100;
      
      // Si on est en bas, réinitialiser le compteur
      if (distanceFromBottom < 100) {
        this.newMessagesCount.set(0);
      }
    });
  }

  scrollToBottomClick() {
    this.isUserScrolling = false;
    this.newMessagesCount.set(0);
    this.scrollToBottom(300);
  }

  // ========================================
  // ✏️ TYPING INDICATOR
  // ========================================

  private setupTypingDebounce() {
    const sub = this.typingSubject.pipe(
      debounceTime(500)
    ).subscribe(isTyping => {
      const conv = this.conversation();
      if (conv?.id) {
        this.messagesService.setTypingStatus(conv.id, this.currentUserId, isTyping);
      }
    });

    this.subscriptions.add(sub);
  }

  onTextInput() {
    const text = this.messageText().trim();
    
    if (text.length > 0) {
      this.typingSubject.next(true);
      
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
      
      this.typingTimeout = setTimeout(() => {
        this.typingSubject.next(false);
      }, 3000);
    } else {
      this.typingSubject.next(false);
      
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
    }
  }

  private observeFriendTyping() {
    const conv = this.conversation();
    if (!conv?.id) return;

    const sub = this.messagesService.observeTypingStatus(conv.id, this.friendId()).subscribe({
      next: (isTyping) => {
        this.friendIsTyping.set(isTyping);
        
        if (isTyping && !this.isUserScrolling) {
          setTimeout(() => this.scrollToBottom(200), 100);
        }
      },
      error: (err) => {
        console.error('Erreur observation typing:', err);
      }
    });

    this.subscriptions.add(sub);
  }

  // ========================================
  // 📖 CHARGEMENT DES DONNÉES
  // ========================================

  private loadFriendData() {
    const sub = this.usersService.getUserProfileOnce(this.friendId()).subscribe({
      next: (user) => {
        this.friend.set(user);
      },
      error: (err) => {
        console.error('Erreur chargement ami:', err);
      }
    });

    this.subscriptions.add(sub);
  }

  private async loadOrCreateConversation() {
    try {
      const conv = await this.messagesService.getOrCreateConversation(
        this.currentUserId,
        this.friendId()
      );
  
      this.conversation.set(conv);
      this.loadMessages();
      this.observeFriendTyping();
      
      await this.markAsRead();
    } catch (error) {
      console.error('Erreur conversation:', error);
      this.isLoading.set(false);
    }
  }
  
  private loadMessages() {
    const conv = this.conversation();
    if (!conv?.id) return;
  
    const sub = this.messagesService.getConversationMessages(conv.id).subscribe({
      next: async (msgs) => {
        const previousLength = this.messages().length;
        this.messages.set(msgs);
        
        // ✅ NOUVEAU : Transformer en ChatItems avec séparateurs et groupement
        this.chatItems.set(transformMessagesToChatItems(msgs, this.currentUserId));
        
        this.isLoading.set(false);
  
        // Nouveau message reçu ?
        if (msgs.length > previousLength) {
          const lastMessage = msgs[msgs.length - 1];
          
          // Si c'est un message de l'ami et qu'on ne scroll pas
          if (lastMessage.senderId !== this.currentUserId) {
            if (this.isUserScrolling) {
              // Incrémenter le badge
              this.newMessagesCount.update(count => count + 1);
            } else {
              // Scroll automatique si on est en bas
              setTimeout(() => this.scrollToBottom(), 100);
            }
            await this.markAsRead();
          } else {
            // C'est notre message, toujours scroll
            setTimeout(() => this.scrollToBottom(), 100);
          }
        } else if (!this.hasScrolledInitially) {
          setTimeout(() => this.scrollToBottom(), 100);
        }
      },
      error: (err) => {
        console.error('Erreur chargement messages:', err);
        this.isLoading.set(false);
      }
    });
  
    this.subscriptions.add(sub);
  }

  private async markAsRead() {
    const conv = this.conversation();
    if (!conv?.id) return;

    try {
      await this.messagesService.markConversationAsRead(conv.id, this.currentUserId);
      console.log('✅ Messages marqués comme lus');
    } catch (error) {
      console.error('Erreur marquage lecture:', error);
    }
  }

  // ========================================
  // ✉️ ENVOI DE MESSAGE
  // ========================================

  async sendMessage() {
    const text = this.messageText().trim();
    if (!text || this.isSending()) return;

    const conv = this.conversation();
    const currentUser = this.authService.currentUser();
    if (!conv?.id || !currentUser) return;

    this.isSending.set(true);

    this.typingSubject.next(false);
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    const messageDto: CreateMessageDto = {
      conversationId: conv.id,
      senderId: currentUser.uid,
      senderDisplayName: currentUser.displayName || 'Utilisateur',
      text: text,
      type: 'text'
    };

    if (currentUser.photoURL) {
      messageDto.senderPhotoURL = currentUser.photoURL;
    }

    try {
      await this.messagesService.sendMessage(messageDto, this.friendId());
      this.messageText.set('');
      this.isUserScrolling = false;
      setTimeout(() => this.scrollToBottom(200), 50);
    } catch (error) {
      console.error('Erreur envoi message:', error);
    } finally {
      this.isSending.set(false);
    }
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(duration: number = 300) {
    setTimeout(() => {
      this.content?.scrollToBottom(duration);
    }, 100);
  }

  // ========================================
  // 🎨 UI HELPERS
  // ========================================

  isMyMessage(message: Message): boolean {
    return message.senderId === this.currentUserId;
  }

  formatMessageTime(message: Message): string {
    if (!message.createdAt) {
      return 'Envoi...';
    }
    
    const date = message.createdAt.toDate();
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  getStatusIcon(message: Message): string {
    switch (message.status) {
      case MessageStatus.READ:
      case MessageStatus.DELIVERED:
        return 'checkmark-done-outline';
      case MessageStatus.SENT:
      default:
        return 'checkmark-outline';
    }
  }

  getPhotoUrl(photoURL?: string | null): string {
    if (!photoURL || photoURL.trim() === '') {
      return 'assets/default-avatar.png';
    }
    return photoURL;
  }

  trackByChatItem(_index: number, item: ChatItem): string {
    if (item.type === 'date-separator') {
      return `date-${item.date.getTime()}`;
    }
    return item.message.id || _index.toString();
  }

  async openImagePicker() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Envoyer une image',
      buttons: [
        {
          text: '📸 Prendre une photo',
          handler: () => {
            this.selectImage('camera');
          }
        },
        {
          text: '🖼️ Choisir depuis la galerie',
          handler: () => {
            this.selectImage('gallery');
          }
        },
        {
          text: 'Annuler',
          role: 'cancel'
        }
      ]
    });
  
    await actionSheet.present();
  }
  
  /**
   * 🖼️ Sélectionne une image
   */
  async selectImage(source: 'camera' | 'gallery') {
    try {
      const blob = await this.storageService.selectImage(source);
      
      if (!blob) {
        return;
      }
  
      // Créer une preview locale
      const previewUrl = this.storageService.createLocalImageUrl(blob);
      
      this.selectedImageBlob.set(blob);
      this.selectedImagePreview.set(previewUrl);
    } catch (error) {
      console.error('Erreur sélection image:', error);
    }
  }
  
  /**
   * ❌ Annule la sélection d'image
   */
  cancelImageSelection() {
    const previewUrl = this.selectedImagePreview();
    if (previewUrl) {
      this.storageService.revokeLocalImageUrl(previewUrl);
    }
    
    this.selectedImageBlob.set(null);
    this.selectedImagePreview.set(null);
  }
  
  /**
   * 📤 Envoie un message avec image
   */
  async sendImageMessage() {
    const blob = this.selectedImageBlob();
    if (!blob || this.isUploadingImage()) return;
  
    const conv = this.conversation();
    const currentUser = this.authService.currentUser();
    if (!conv?.id || !currentUser) return;
  
    this.isUploadingImage.set(true);
  
    try {
      // 1. Upload l'image vers Firebase Storage
      const imageUrl = await this.storageService.uploadMessageImage(
        blob,
        currentUser.uid,
        conv.id
      );
  
      // 2. Créer le message
      const messageDto: CreateMessageDto = {
        conversationId: conv.id,
        senderId: currentUser.uid,
        senderDisplayName: currentUser.displayName || 'Utilisateur',
        text: '📸 Photo',
        type: 'image',
        imageUrl: imageUrl
      };
  
      if (currentUser.photoURL) {
        messageDto.senderPhotoURL = currentUser.photoURL;
      }
  
      // 3. Envoyer le message
      await this.messagesService.sendMessage(messageDto, this.friendId());
  
      // 4. Nettoyer
      this.cancelImageSelection();
      this.isUserScrolling = false;
      setTimeout(() => this.scrollToBottom(200), 50);
    } catch (error) {
      console.error('Erreur envoi image:', error);
    } finally {
      this.isUploadingImage.set(false);
    }
  }
  
  /**
   * 🔍 Ouvre l'image en grand
   */
  async openImageModal(imageUrl: string) {
    const modal = await this.modalCtrl.create({
      component: ImageViewerModal,
      componentProps: { imageUrl },
      cssClass: 'image-viewer-modal'
    });
  
    await modal.present();
  }

/**
 * 📱 Ouvre le menu d'actions pour un message (long press)
 */
async openMessageMenu(message: Message) {
  const isMyMessage = this.isMyMessage(message);
  
  const buttons: any[] = [];

  // ✅ NOUVEAU : Copier uniquement pour les messages texte
  if (message.type !== 'image') {
    buttons.push({
      text: '📋 Copier',
      handler: () => {
        this.copyMessage(message);
      }
    });
  }

  // Réactions disponibles pour tous
  buttons.push({
    text: '😍 Réagir',
    handler: () => {
      this.openReactionPicker(message);
    }
  });

  // Édition et suppression uniquement pour mes messages
  if (isMyMessage && !message.isDeleted) {
    // Ne pas permettre la modification des images
    if (message.type !== 'image') {
      buttons.push({
        text: '✏️ Modifier',
        handler: () => {
          this.editMessage(message);
        }
      });
    }

    buttons.push({
      text: '🗑️ Supprimer',
      role: 'destructive',
      handler: () => {
        this.deleteMessage(message);
      }
    });
  }

  buttons.push({
    text: 'Annuler',
    role: 'cancel'
  });

  const actionSheet = await this.actionSheetCtrl.create({
    header: 'Actions',
    buttons: buttons
  });

  await actionSheet.present();
}
  
  /**
   * 📋 Copie le texte d'un message dans le presse-papier
   */
  async copyMessage(message: Message) {
    try {
      await Clipboard.write({
        string: message.text
      });
      console.log('✅ Message copié');
    } catch (error) {
      console.error('❌ Erreur copie:', error);
    }
  }
  
  /**
   * ✏️ Modifie un message
   */
  async editMessage(message: Message) {
    const alert = await this.alertCtrl.create({
      header: 'Modifier le message',
      inputs: [
        {
          name: 'text',
          type: 'textarea',
          value: message.text,
          placeholder: 'Nouveau texte...'
        }
      ],
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Modifier',
          handler: async (data) => {
            const newText = data.text.trim();
            if (!newText || newText === message.text) {
              return;
            }
  
            const conv = this.conversation();
            if (!conv?.id || !message.id) return;
  
            try {
              await this.messagesService.editMessage(conv.id, message.id, newText);
              console.log('✅ Message modifié');
            } catch (error) {
              console.error('❌ Erreur modification:', error);
            }
          }
        }
      ]
    });
  
    await alert.present();
  }
  
  /**
   * 🗑️ Supprime un message
   */
  async deleteMessage(message: Message) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer le message',
      message: 'Êtes-vous sûr de vouloir supprimer ce message ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: async () => {
            const conv = this.conversation();
            if (!conv?.id || !message.id) return;
  
            try {
              await this.messagesService.deleteMessage(conv.id, message.id);
              console.log('✅ Message supprimé');
            } catch (error) {
              console.error('❌ Erreur suppression:', error);
            }
          }
        }
      ]
    });
  
    await alert.present();
  }
  
  /**
 * 😍 Ouvre le sélecteur de réactions
 */
async openReactionPicker(message: Message) {
  const emojis = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
  
  // ✅ CORRECTION : Typer explicitement le tableau
  const buttons: any[] = emojis.map(emoji => ({
    text: emoji,
    handler: () => {
      this.addReaction(message, emoji);
    }
  }));

  buttons.push({
    text: 'Annuler',
    role: 'cancel'
  });

  const actionSheet = await this.actionSheetCtrl.create({
    header: 'Choisir une réaction',
    buttons: buttons,
    cssClass: 'reaction-picker'
  });

  await actionSheet.present();
}
  
  /**
   * 😍 Ajoute une réaction à un message
   */
  /**
 * 😍 Ajoute/retire une réaction à un message
 */
async addReaction(message: Message, emoji: string) {
  const conv = this.conversation();
  const currentUser = this.authService.currentUser();
  
  if (!conv?.id || !message.id || !currentUser) return;

  try {
    // ✅ Si l'utilisateur clique sur sa propre réaction, la retirer
    if (this.hasUserReacted(message, emoji)) {
      await this.removeReaction(message);
    } else {
      // ✅ Sinon, ajouter/remplacer la réaction
      await this.messagesService.addReaction(
        conv.id,
        message.id,
        emoji,
        currentUser.uid,
        currentUser.displayName || 'Utilisateur'
      );
      console.log('✅ Réaction ajoutée');
    }
  } catch (error) {
    console.error('❌ Erreur réaction:', error);
  }
}

/**
 * 🗑️ Retire la réaction d'un utilisateur
 */
async removeReaction(message: Message) {
  const conv = this.conversation();
  const currentUser = this.authService.currentUser();
  
  if (!conv?.id || !message.id || !currentUser) return;

  try {
    const messageRef = doc(
      this.messagesService['firestore'],
      'conversations',
      conv.id,
      'messages',
      message.id
    );

    const messageDoc = await getDoc(messageRef);
    if (!messageDoc.exists()) return;

    const messageData = messageDoc.data() as Message;
    const reactions = (messageData.reactions || []).filter(
      r => r.userId !== currentUser.uid
    );

    await updateDoc(messageRef, {
      reactions: reactions.length > 0 ? reactions : []
    });

    console.log('✅ Réaction retirée');
  } catch (error) {
    console.error('❌ Erreur suppression réaction:', error);
  }
}
  
  /**
   * 😍 Récupère les réactions groupées par emoji
   */
  getGroupedReactions(message: Message): { emoji: string; count: number; users: string[] }[] {
    if (!message.reactions || message.reactions.length === 0) {
      return [];
    }
  
    const grouped = new Map<string, { count: number; users: string[] }>();
  
    message.reactions.forEach(reaction => {
      const existing = grouped.get(reaction.emoji);
      if (existing) {
        existing.count++;
        existing.users.push(reaction.userDisplayName);
      } else {
        grouped.set(reaction.emoji, {
          count: 1,
          users: [reaction.userDisplayName]
        });
      }
    });
  
    return Array.from(grouped.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      users: data.users
    }));
  }
  
  /**
   * 😍 Vérifie si l'utilisateur actuel a réagi avec cet emoji
   */
  hasUserReacted(message: Message, emoji: string): boolean {
    if (!message.reactions) return false;
    
    return message.reactions.some(
      r => r.userId === this.currentUserId && r.emoji === emoji
    );
  }

/**
 * 📱 Gestion du touch/mouse start (début du press)
 */
onTouchStart(event: TouchEvent | MouseEvent, message: Message) {
  if (message.isDeleted) return;
  
  // ✅ NOUVEAU : Enregistrer la position de départ
  if (event instanceof TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  } else {
    this.touchStartX = event.clientX;
    this.touchStartY = event.clientY;
  }
  
  this.isPressing = true;
  
  // Déclencher le menu après 500ms de press
  this.pressTimer = setTimeout(() => {
    if (this.isPressing) {
      // Vibration haptique si disponible
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      this.openMessageMenu(message);
    }
  }, 500);
}

/**
 * 📱 Gestion du touch move (détection du scroll)
 */
onTouchMove(event: TouchEvent | MouseEvent) {
  // ✅ NOUVEAU : Si l'utilisateur bouge son doigt, annuler le long press
  let currentX = 0;
  let currentY = 0;
  
  if (event instanceof TouchEvent) {
    currentX = event.touches[0].clientX;
    currentY = event.touches[0].clientY;
  } else {
    currentX = event.clientX;
    currentY = event.clientY;
  }
  
  const deltaX = Math.abs(currentX - this.touchStartX);
  const deltaY = Math.abs(currentY - this.touchStartY);
  
  // Si mouvement > 10px, c'est un scroll, pas un press
  if (deltaX > 10 || deltaY > 10) {
    this.isPressing = false;
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }
  }
}

/**
 * 📱 Gestion du touch/mouse end (fin du press)
 */
onTouchEnd(event?: TouchEvent | MouseEvent) {
  this.isPressing = false;
  if (this.pressTimer) {
    clearTimeout(this.pressTimer);
  }
}

  /**
   * 📱 Gestion du touch/mouse cancel (annulation)
   */
  onTouchCancel(event?: TouchEvent | MouseEvent) {
    this.isPressing = false;
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }
  }

  goToFriendProfile() {
    this.router.navigate(['/social/friend-profile', this.friendId()]);
  }
}