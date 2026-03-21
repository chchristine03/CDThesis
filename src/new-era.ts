import axios from 'axios';
import type { Artist, PagingObject } from './spotify-client';

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

export type NewEraLabel = 'Entering New Era' | 'Transitional' | 'Established Taste';

export interface NewEraDebug {
  shortCount: number;
  medCount: number;
  newCount: number;
}

export interface NewEraResult {
  new_artist_ratio: number;
  new_artist_ids: string[];
  label: NewEraLabel;
  debug: NewEraDebug;
}

export interface NewEraThresholds {
  enteringNewEra: number;
  transitional: number;
}

export interface NewEraOptions {
  thresholds?: NewEraThresholds;
}

const DEFAULT_THRESHOLDS: NewEraThresholds = {
  enteringNewEra: 0.4,
  transitional: 0.2,
};

async function fetchTopArtistIds(
  token: string,
  timeRange: 'short_term' | 'medium_term',
  limit: number = 50
): Promise<string[]> {
  const url = `${SPOTIFY_API_BASE_URL}/me/top/artists`;

  const response = await axios.get<PagingObject<Artist>>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      time_range: timeRange,
      limit,
    },
  });

  const items = response.data.items ?? [];
  return items.map((artist) => artist.id).filter((id): id is string => Boolean(id));
}

function classifyNewEra(
  ratio: number,
  thresholds: NewEraThresholds
): NewEraLabel {
  if (ratio >= thresholds.enteringNewEra) {
    return 'Entering New Era';
  }
  if (ratio >= thresholds.transitional) {
    return 'Transitional';
  }
  return 'Established Taste';
}

export async function computeNewEra(
  token: string,
  options: NewEraOptions = {}
): Promise<NewEraResult> {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;

  try {
    const [shortIds, medIds] = await Promise.all([
      fetchTopArtistIds(token, 'short_term', 50),
      fetchTopArtistIds(token, 'medium_term', 50),
    ]);

    const shortSet = new Set(shortIds);
    const medSet = new Set(medIds);

    const shortCount = shortIds.length;
    const medCount = medIds.length;

    const newArtistIds: string[] = [];
    for (const id of shortSet) {
      if (!medSet.has(id)) {
        newArtistIds.push(id);
      }
    }

    const newCount = newArtistIds.length;
    const denominator = shortCount || 1;
    const newArtistRatio = shortCount === 0 ? 0 : newCount / denominator;
    const label = classifyNewEra(newArtistRatio, thresholds);

    return {
      new_artist_ratio: newArtistRatio,
      new_artist_ids: newArtistIds,
      label,
      debug: {
        shortCount,
        medCount,
        newCount,
      },
    };
  } catch (error) {
    console.error('computeNewEra failed', error);

    return {
      new_artist_ratio: 0,
      new_artist_ids: [],
      label: 'Established Taste',
      debug: {
        shortCount: 0,
        medCount: 0,
        newCount: 0,
      },
    };
  }
}

