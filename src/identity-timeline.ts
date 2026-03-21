import axios from 'axios';
import type { Artist, PagingObject } from './spotify-client';

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

export type IdentityTimelineLabel = 'Anchored' | 'Evolving' | 'In Transition';

export interface IdentityTimelineShares {
  core_share: number;
  emerging_share: number;
  fading_share: number;
}

export interface IdentityTimelineDebug {
  shortCount: number;
  longCount: number;
  activeCoreCount: number;
  emergingCount: number;
  fadingCount: number;
}

export interface IdentityTimelineResult {
  active_core_ids: string[];
  emerging_ids: string[];
  fading_ids: string[];
  shares: IdentityTimelineShares;
  summary_label: IdentityTimelineLabel;
  debug: IdentityTimelineDebug;
}

export interface IdentityTimelineThresholds {
  anchoredCoreShare: number;
  anchoredEmergingMax: number;
  evolvingEmergingShare: number;
}

export interface IdentityTimelineOptions {
  thresholds?: IdentityTimelineThresholds;
}

const DEFAULT_THRESHOLDS: IdentityTimelineThresholds = {
  anchoredCoreShare: 0.45,
  anchoredEmergingMax: 0.3,
  evolvingEmergingShare: 0.4,
};

async function fetchTopArtistIds(
  token: string,
  timeRange: 'short_term' | 'long_term',
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

function classifyIdentityTimeline(
  coreShare: number,
  emergingShare: number,
  thresholds: IdentityTimelineThresholds
): IdentityTimelineLabel {
  if (coreShare >= thresholds.anchoredCoreShare && emergingShare < thresholds.anchoredEmergingMax) {
    return 'Anchored';
  }

  if (emergingShare >= thresholds.evolvingEmergingShare) {
    return 'Evolving';
  }

  return 'In Transition';
}

export async function computeIdentityTimeline(
  token: string,
  options: IdentityTimelineOptions = {}
): Promise<IdentityTimelineResult> {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;

  try {
    const [shortIds, longIds] = await Promise.all([
      fetchTopArtistIds(token, 'short_term', 50),
      fetchTopArtistIds(token, 'long_term', 50),
    ]);

    const shortSet = new Set(shortIds);
    const longSet = new Set(longIds);

    const shortCount = shortIds.length;
    const longCount = longIds.length;

    const activeCoreIds: string[] = [];
    const emergingIds: string[] = [];
    const fadingIds: string[] = [];

    // active_core = A_short ∩ A_long, emerging = A_short \ A_long
    for (const id of shortSet) {
      if (longSet.has(id)) {
        activeCoreIds.push(id);
      } else {
        emergingIds.push(id);
      }
    }

    // fading = A_long \ A_short
    for (const id of longSet) {
      if (!shortSet.has(id)) {
        fadingIds.push(id);
      }
    }

    const activeCoreCount = activeCoreIds.length;
    const emergingCount = emergingIds.length;
    const fadingCount = fadingIds.length;

    const coreShare =
      shortCount === 0 ? 0 : activeCoreCount / shortCount;
    const emergingShare =
      shortCount === 0 ? 0 : emergingCount / shortCount;
    const fadingShare =
      longCount === 0 ? 0 : fadingCount / longCount;

    const summaryLabel = classifyIdentityTimeline(coreShare, emergingShare, thresholds);

    return {
      active_core_ids: activeCoreIds,
      emerging_ids: emergingIds,
      fading_ids: fadingIds,
      shares: {
        core_share: coreShare,
        emerging_share: emergingShare,
        fading_share: fadingShare,
      },
      summary_label: summaryLabel,
      debug: {
        shortCount,
        longCount,
        activeCoreCount,
        emergingCount,
        fadingCount,
      },
    };
  } catch (error) {
    console.error('computeIdentityTimeline failed', error);

    return {
      active_core_ids: [],
      emerging_ids: [],
      fading_ids: [],
      shares: {
        core_share: 0,
        emerging_share: 0,
        fading_share: 0,
      },
      summary_label: 'In Transition',
      debug: {
        shortCount: 0,
        longCount: 0,
        activeCoreCount: 0,
        emergingCount: 0,
        fadingCount: 0,
      },
    };
  }
}

