// src/app/core/helpers/event-type.helper.ts
// 🎯 Helper pour déterminer le type d'accès d'un événement
// Utilisé dans event-detail, event-card, event-list

import { Event } from '../models/event.model';

/**
 * Énumération des types d'accès aux événements
 */
export enum EventAccessType {
  PUBLIC = 'public',           // 🌍 Inscription immédiate, visible par tous
  INVITATION = 'invitation',   // 📝 Demande à approuver, visible par tous
  PRIVATE = 'private'          // 🔒 Invisible sauf pour invités
}

/**
 * 🎯 Détermine le type d'accès d'un événement
 * 
 * Logique :
 * - isPrivate = true → PRIVATE (invisible dans event-list)
 * - isPrivate = false + requiresApproval = true → INVITATION (cas principal)
 * - isPrivate = false + requiresApproval = false → PUBLIC (événements pros)
 */
export function getEventAccessType(event: Event): EventAccessType {
  if (event.isPrivate) {
    return EventAccessType.PRIVATE;
  }
  
  if (event.requiresApproval) {
    return EventAccessType.INVITATION;
  }
  
  return EventAccessType.PUBLIC;
}

/**
 * 🏷️ Retourne le label correspondant au type d'accès
 */
export function getAccessTypeLabel(type: EventAccessType): string {
  switch (type) {
    case EventAccessType.PUBLIC:
      return 'Public';
    case EventAccessType.INVITATION:
      return 'Sur invitation';
    case EventAccessType.PRIVATE:
      return 'Privé';
  }
}

/**
 * 🎨 Retourne l'icône Ionicons correspondant au type d'accès
 */
export function getAccessTypeIcon(type: EventAccessType): string {
  switch (type) {
    case EventAccessType.PUBLIC:
      return 'globe-outline';
    case EventAccessType.INVITATION:
      return 'mail-outline';
    case EventAccessType.PRIVATE:
      return 'lock-closed-outline';
  }
}

/**
 * 🎨 Retourne la couleur Ionic correspondant au type d'accès
 */
export function getAccessTypeColor(type: EventAccessType): string {
  switch (type) {
    case EventAccessType.PUBLIC:
      return 'success';
    case EventAccessType.INVITATION:
      return 'warning';
    case EventAccessType.PRIVATE:
      return 'dark';
  }
}

/**
 * 📝 Retourne une description courte du type d'accès
 */
export function getAccessTypeDescription(type: EventAccessType): string {
  switch (type) {
    case EventAccessType.PUBLIC:
      return 'Tout le monde peut rejoindre instantanément';
    case EventAccessType.INVITATION:
      return 'Les demandes doivent être approuvées';
    case EventAccessType.PRIVATE:
      return 'Visible uniquement par les invités';
  }
}

/**
 * ✅ Vérifie si un événement est visible dans la liste publique
 */
export function isEventVisibleInPublicList(event: Event): boolean {
  return !event.isPrivate;
}