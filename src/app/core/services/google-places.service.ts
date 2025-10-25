// src/app/core/services/google-places.service.ts
import { Injectable } from '@angular/core';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AddressPrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
}

@Injectable({
  providedIn: 'root'
})
export class GooglePlacesService {
  
  private autocompleteService?: google.maps.places.AutocompleteService;
  private placesService?: google.maps.places.PlacesService;
  private isLoaded$ = new BehaviorSubject<boolean>(false);
  
  constructor() {
    this.loadGoogleMapsScript();
  }

  private loadGoogleMapsScript(): void {
    if (typeof google !== 'undefined' && google.maps) {
      this.initializeServices();
      this.isLoaded$.next(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMaps.apiKey}&libraries=places&language=fr`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      this.initializeServices();
      this.isLoaded$.next(true);
      console.log('✅ Google Maps chargé');
    };
    
    script.onerror = (error) => {
      console.error('❌ Erreur chargement Google Maps:', error);
    };
    
    document.head.appendChild(script);
  }

  private initializeServices(): void {
    if (typeof google === 'undefined' || !google.maps) return;

    this.autocompleteService = new google.maps.places.AutocompleteService();
    const div = document.createElement('div');
    this.placesService = new google.maps.places.PlacesService(div);
  }

  isReady(): Observable<boolean> {
    return this.isLoaded$.asObservable();
  }

  getAddressPredictions(input: string): Observable<AddressPrediction[]> {
    if (!this.autocompleteService || input.length < 3) {
      return from(Promise.resolve([]));
    }

    const request: google.maps.places.AutocompletionRequest = {
      input: input,
      language: 'fr',
      componentRestrictions: { country: 'fr' },
      types: ['address']
    };

    return from(
      new Promise<AddressPrediction[]>((resolve, reject) => {
        this.autocompleteService!.getPlacePredictions(request, (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            const results = predictions.map(p => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text
            }));
            resolve(results);
          } else {
            resolve([]);
          }
        });
      })
    );
  }

  getPlaceDetails(placeId: string): Observable<PlaceDetails> {
    if (!this.placesService) {
      return from(Promise.reject('PlacesService non initialisé'));
    }

    const request: google.maps.places.PlaceDetailsRequest = {
      placeId: placeId,
      fields: ['address_components', 'formatted_address', 'geometry', 'name']
    };

    return from(
      new Promise<PlaceDetails>((resolve, reject) => {
        this.placesService!.getDetails(request, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const details = this.parsePlaceDetails(place);
            resolve(details);
          } else {
            reject(new Error(`Place details failed: ${status}`));
          }
        });
      })
    );
  }

  private parsePlaceDetails(place: google.maps.places.PlaceResult): PlaceDetails {
    const components = place.address_components || [];
    
    const getComponent = (type: string): string => {
      const component = components.find(c => c.types.includes(type));
      return component ? component.long_name : '';
    };

    const streetNumber = getComponent('street_number');
    const route = getComponent('route');
    const locality = getComponent('locality');
    const postalCode = getComponent('postal_code');
    const country = getComponent('country');

    let address = '';
    if (streetNumber) address += streetNumber + ' ';
    if (route) address += route;
    address = address.trim() || place.formatted_address || '';

    const city = locality || '';
    const lat = place.geometry?.location?.lat() || 0;
    const lng = place.geometry?.location?.lng() || 0;

    return {
      placeId: place.place_id || '',
      formattedAddress: place.formatted_address || '',
      address: address,
      city: city,
      zipCode: postalCode,
      country: country,
      latitude: lat,
      longitude: lng
    };
  }
}