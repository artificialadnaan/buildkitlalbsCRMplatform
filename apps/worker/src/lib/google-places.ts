import { RateLimiter } from './rate-limiter.js';

const BASE_URL = 'https://places.googleapis.com/v1';

const rateLimiter = new RateLimiter(10, 1000); // 10 req/s

interface PlaceSearchResult {
  places: GooglePlace[];
  nextPageToken?: string;
}

export interface GooglePlace {
  id: string;                              // place ID
  displayName: { text: string };
  formattedAddress: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  googleMapsUri?: string;
  types?: string[];
  addressComponents?: AddressComponent[];
}

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

interface ParsedPlace {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  website: string | null;
  googlePlaceId: string;
  googleRating: number | null;
  industry: string | null;
}

const RETRY_DELAYS = [1000, 3000, 9000]; // exponential backoff: 1s, 3s, 9s

async function fetchWithRetry(url: string, options: RequestInit, attempt = 0): Promise<Response> {
  await rateLimiter.acquire();

  const response = await fetch(url, options);

  if (response.status === 429 || (response.status >= 500 && attempt < RETRY_DELAYS.length)) {
    const delay = RETRY_DELAYS[attempt];
    console.warn(`[Places API] Rate limited or server error (${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS.length})`);
    await new Promise(r => setTimeout(r, delay));
    return fetchWithRetry(url, options, attempt + 1);
  }

  return response;
}

export async function searchPlaces(query: string, zipCode: string, apiKey: string): Promise<GooglePlace[]> {
  const allPlaces: GooglePlace[] = [];
  let pageToken: string | undefined;

  // Google Places (New) Text Search paginates with nextPageToken
  do {
    const body: Record<string, unknown> = {
      textQuery: `${query} in ${zipCode}`,
      languageCode: 'en',
      maxResultCount: 20,
    };

    if (pageToken) {
      body.pageToken = pageToken;
    }

    const response = await fetchWithRetry(`${BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.googleMapsUri,places.types,places.addressComponents,nextPageToken',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Places API Text Search failed (${response.status}): ${errorBody}`);
    }

    const data: PlaceSearchResult = await response.json();

    if (data.places) {
      allPlaces.push(...data.places);
    }

    pageToken = data.nextPageToken;

    // Safety limit: don't fetch more than 60 results per zip code
    if (allPlaces.length >= 60) break;
  } while (pageToken);

  return allPlaces;
}

export function parsePlace(place: GooglePlace): ParsedPlace {
  const addressComponents = place.addressComponents || [];

  function findComponent(type: string): string {
    const comp = addressComponents.find(c => c.types.includes(type));
    return comp?.longText || '';
  }

  const city = findComponent('locality') || findComponent('sublocality');
  const state = findComponent('administrative_area_level_1');
  const zip = findComponent('postal_code');

  // Map Google place types to a simple industry string
  const typeMap: Record<string, string> = {
    restaurant: 'Restaurant',
    plumber: 'Plumbing',
    electrician: 'Electrical',
    roofing_contractor: 'Roofing',
    general_contractor: 'General Contractor',
    painter: 'Painting',
    car_repair: 'Auto Repair',
    dentist: 'Dental',
    lawyer: 'Legal',
    real_estate_agency: 'Real Estate',
    hair_care: 'Hair Salon',
    gym: 'Fitness',
    accounting: 'Accounting',
    locksmith: 'Locksmith',
    moving_company: 'Moving',
    pet_store: 'Pet Services',
    veterinary_care: 'Veterinary',
    florist: 'Florist',
  };

  let industry: string | null = null;
  if (place.types) {
    for (const t of place.types) {
      if (typeMap[t]) {
        industry = typeMap[t];
        break;
      }
    }
  }

  return {
    name: place.displayName?.text || 'Unknown',
    address: place.formattedAddress || '',
    city,
    state,
    zip,
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    googlePlaceId: place.id,
    googleRating: place.rating ?? null,
    industry,
  };
}
