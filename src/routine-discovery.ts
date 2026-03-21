import axios from 'axios';
import type { PagingObject, Track } from './spotify-client';

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

export type RoutineDiscoveryLabel =
  | 'PATH_FOLLOWER'
  | 'IN_ROTATION'
  | 'EXPLORER'
  | null;

export interface FavoriteInRotation {
  trackName: string;
  artistName: string;
}

export interface RoutineDiscoveryStats {
  shortTermCount: number;
  mediumTermCount: number;
  intersectionCount: number;
  unionCount: number;
}

export interface RoutineDiscoveryDebug {
  shortSampleIds: string[];
  mediumSampleIds: string[];
}

export interface RoutineDiscoveryResult {
  familiarity_score: number;
  label: RoutineDiscoveryLabel;
  favoritesInRotation: FavoriteInRotation[];
  stats: RoutineDiscoveryStats;
  debug: RoutineDiscoveryDebug;
}

export async function computeRoutineDiscovery(
  token: string
): Promise<RoutineDiscoveryResult> {
  try {
    // 1) Short-term top tracks (≤ 50)
    const shortResponse = await axios.get<PagingObject<Track>>(
      `${SPOTIFY_API_BASE_URL}/me/top/tracks`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          time_range: 'short_term',
          limit: 50,
        },
      }
    );

    const shortItems = shortResponse.data.items ?? [];
    const shortTermTrackIds: string[] = shortItems
      .map((track) => track.id)
      .filter((id): id is string => Boolean(id));

    // 2) Medium-term top tracks (≤ 50)
    const mediumResponse = await axios.get<PagingObject<Track>>(
      `${SPOTIFY_API_BASE_URL}/me/top/tracks`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          time_range: 'medium_term',
          limit: 50,
        },
      }
    );

    const mediumItems = mediumResponse.data.items ?? [];
    const mediumTermTrackIds: string[] = mediumItems
      .map((track) => track.id)
      .filter((id): id is string => Boolean(id));

    const shortTermCount = shortTermTrackIds.length;
    const mediumTermCount = mediumTermTrackIds.length;

    if (shortTermCount === 0) {
      return {
        familiarity_score: 0,
        label: 'EXPLORER',
        favoritesInRotation: [],
        stats: {
          shortTermCount,
          mediumTermCount,
          intersectionCount: 0,
          unionCount: 0,
        },
        debug: {
          shortSampleIds: [],
          mediumSampleIds: [],
        },
      };
    }

    const mediumSet = new Set(mediumTermTrackIds);
    let intersectionCount = 0;
    const favoritesInRotation: FavoriteInRotation[] = [];

    for (const track of shortItems) {
      const id = track.id;
      if (!id) continue;
      if (mediumSet.has(id)) {
        intersectionCount += 1;
        if (favoritesInRotation.length < 5) {
          favoritesInRotation.push({
            trackName: track.name ?? '',
            artistName: track.artists?.[0]?.name ?? '',
          });
        }
      }
    }

    const unionCount = shortTermCount + mediumTermCount - intersectionCount;
    const familiarity_score =
      shortTermCount > 0 ? intersectionCount / shortTermCount : 0;

    let label: RoutineDiscoveryLabel;
    if (familiarity_score >= 0.55) {
      label = 'PATH_FOLLOWER';
    } else if (familiarity_score >= 0.3) {
      label = 'IN_ROTATION';
    } else {
      label = 'EXPLORER';
    }

    return {
      familiarity_score,
      label,
      favoritesInRotation,
      stats: {
        shortTermCount,
        mediumTermCount,
        intersectionCount,
        unionCount,
      },
      debug: {
        shortSampleIds: shortTermTrackIds.slice(0, 5),
        mediumSampleIds: mediumTermTrackIds.slice(0, 5),
      },
    };
  } catch (error) {
    console.error('computeRoutineDiscovery failed', error);

    return {
      familiarity_score: 0,
      label: null,
      favoritesInRotation: [],
      stats: {
        shortTermCount: 0,
        mediumTermCount: 0,
        intersectionCount: 0,
        unionCount: 0,
      },
      debug: {
        shortSampleIds: [],
        mediumSampleIds: [],
      },
    };
  }
}

