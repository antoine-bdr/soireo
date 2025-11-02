// src/app/features/social/conversation/image-viewer-modal.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonContent, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-image-viewer-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonContent
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="image-container">
        <img [src]="imageUrl" alt="Image en grand">
      </div>
    </ion-content>
  `,
  styles: [`
    ion-content {
      --background: #000;
    }

    .image-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      
      img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
    }

    ion-toolbar {
      --background: transparent;
      --color: white;
    }
  `]
})
export class ImageViewerModal {
  @Input() imageUrl!: string;

  constructor(private modalCtrl: ModalController) {
    addIcons({ closeOutline });
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}