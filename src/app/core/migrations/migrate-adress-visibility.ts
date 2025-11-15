// src/app/core/migrations/migrate-address-visibility.ts
// ✅ NOUVEAU (ÉTAPE 11) - Migration AddressVisibility

import { 
  Firestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc 
} from '@angular/fire/firestore';
import { Event, AddressVisibility } from '../models/event.model';

/**
 * Migration : Force AddressVisibility.PARTICIPANTS_ONLY
 * 
 * CONTEXTE :
 * - PUBLIC et CITY_ONLY supprimés
 * - Seul PARTICIPANTS_ONLY supporté
 * 
 * USAGE :
 * - Appeler une fois au démarrage (avec flag localStorage)
 */
export async function migrateAddressVisibility(firestore: Firestore): Promise<void> {
  console.log('🔄 Migration AddressVisibility démarrée...');
  
  const eventsRef = collection(firestore, 'events');
  const snapshot = await getDocs(eventsRef);
  
  const batch = writeBatch(firestore);
  let count = 0;
  
  snapshot.docs.forEach(docSnap => {
    const event = docSnap.data() as Event;
    const location = event.location;
    
    if (location.visibility && 
        location.visibility !== AddressVisibility.PARTICIPANTS_ONLY) {
      
      console.log(`  🔧 Migration: ${event.title}`);
      console.log(`     Ancien: ${location.visibility} → Nouveau: participants_only`);
      
      batch.update(docSnap.ref, {
        'location.visibility': AddressVisibility.PARTICIPANTS_ONLY
      });
      
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`✅ ${count} événement(s) migré(s)`);
  } else {
    console.log('✅ Aucune migration nécessaire');
  }
}