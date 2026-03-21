import type { Artist, PagingObject, Track } from '../src/spotify-client';

export type HouseSpec = {
  energy: number;
  valence: number;
  tempo: number;
  genreDominance: number;
  diversity: number;
  intensity: number;
  genreWeights: Record<string, number>;
  topArtistCount: number;
  topTrackCount: number;
  uniqueGenreCount: number;
  topGenre: string | null;
  topGenreWeight: number;
  avgArtistPopularity: number;
  avgTrackPopularity: number;
  userProfile: {
    id: string;
    displayName: string;
    country: string | null;
    product: string | null;
    followers: number | null;
    imageUrl: string | null;
  };
  topArtists: Array<{
    id: string;
    name: string;
    popularity: number;
  }>;
  topTracks: Array<{
    id: string;
    name: string;
    popularity: number;
    artists: string[];
  }>;
  timeRange: {
    key: 'short_term' | 'medium_term' | 'long_term';
    label: string;
    description: string;
  };
  updatedAt: string;
};

export type HousePreset = 'calm' | 'hype' | 'sad';

const PRESETS: Record<HousePreset, HouseSpec> = {
  calm: {
    energy: 0.28,
    valence: 0.62,
    tempo: 78,
    genreDominance: 0.32,
    diversity: 0.74,
    intensity: 0.35,
    genreWeights: {
      'indie folk': 0.22,
      'dream pop': 0.18,
      'ambient': 0.16,
      'acoustic': 0.15,
      'lo-fi': 0.15,
      'alt pop': 0.14,
    },
    topArtistCount: 20,
    topTrackCount: 20,
    uniqueGenreCount: 18,
    topGenre: 'indie folk',
    topGenreWeight: 0.22,
    avgArtistPopularity: 62,
    avgTrackPopularity: 58,
    userProfile: {
      id: 'demo_user',
      displayName: 'Demo Listener',
      country: 'US',
      product: 'premium',
      followers: 128,
      imageUrl: null,
    },
    topArtists: [
      { id: 'a1', name: 'Phoebe Bridgers', popularity: 72 },
      { id: 'a2', name: 'Fleet Foxes', popularity: 68 },
      { id: 'a3', name: 'Men I Trust', popularity: 65 },
      { id: 'a4', name: 'Bon Iver', popularity: 70 },
      { id: 'a5', name: 'Clairo', popularity: 64 },
    ],
    topTracks: [
      { id: 't1', name: 'Garden Song', popularity: 66, artists: ['Phoebe Bridgers'] },
      { id: 't2', name: 'Mykonos', popularity: 63, artists: ['Fleet Foxes'] },
      { id: 't3', name: 'Show Me How', popularity: 61, artists: ['Men I Trust'] },
      { id: 't4', name: 'Holocene', popularity: 69, artists: ['Bon Iver'] },
      { id: 't5', name: 'Bags', popularity: 62, artists: ['Clairo'] },
    ],
    timeRange: {
      key: 'short_term',
      label: 'Short term',
      description: 'Approximately the last 4 weeks',
    },
    updatedAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
  },
  hype: {
    energy: 0.88,
    valence: 0.7,
    tempo: 148,
    genreDominance: 0.44,
    diversity: 0.52,
    intensity: 0.9,
    genreWeights: {
      'pop': 0.26,
      'dance': 0.2,
      'hip hop': 0.18,
      'electronic': 0.16,
      'house': 0.12,
      'alt pop': 0.08,
    },
    topArtistCount: 20,
    topTrackCount: 20,
    uniqueGenreCount: 12,
    topGenre: 'pop',
    topGenreWeight: 0.26,
    avgArtistPopularity: 72,
    avgTrackPopularity: 84,
    userProfile: {
      id: 'demo_user',
      displayName: 'Demo Listener',
      country: 'US',
      product: 'premium',
      followers: 128,
      imageUrl: null,
    },
    topArtists: [
      { id: 'a1', name: 'Dua Lipa', popularity: 92 },
      { id: 'a2', name: 'Drake', popularity: 95 },
      { id: 'a3', name: 'Calvin Harris', popularity: 90 },
      { id: 'a4', name: 'Bad Bunny', popularity: 94 },
      { id: 'a5', name: 'Peggy Gou', popularity: 80 },
    ],
    topTracks: [
      { id: 't1', name: 'Levitating', popularity: 91, artists: ['Dua Lipa'] },
      { id: 't2', name: 'One Dance', popularity: 89, artists: ['Drake'] },
      { id: 't3', name: 'Blame', popularity: 86, artists: ['Calvin Harris'] },
      { id: 't4', name: 'Tití Me Preguntó', popularity: 92, artists: ['Bad Bunny'] },
      { id: 't5', name: 'It Goes Like (Nanana)', popularity: 84, artists: ['Peggy Gou'] },
    ],
    timeRange: {
      key: 'short_term',
      label: 'Short term',
      description: 'Approximately the last 4 weeks',
    },
    updatedAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
  },
  sad: {
    energy: 0.38,
    valence: 0.22,
    tempo: 92,
    genreDominance: 0.48,
    diversity: 0.46,
    intensity: 0.58,
    genreWeights: {
      'indie': 0.24,
      'sad rap': 0.19,
      'alt rock': 0.17,
      'emo': 0.16,
      'acoustic': 0.13,
      'singer-songwriter': 0.11,
    },
    topArtistCount: 20,
    topTrackCount: 20,
    uniqueGenreCount: 10,
    topGenre: 'indie',
    topGenreWeight: 0.24,
    avgArtistPopularity: 44,
    avgTrackPopularity: 41,
    userProfile: {
      id: 'demo_user',
      displayName: 'Demo Listener',
      country: 'US',
      product: 'free',
      followers: 128,
      imageUrl: null,
    },
    topArtists: [
      { id: 'a1', name: 'Joji', popularity: 83 },
      { id: 'a2', name: 'The National', popularity: 72 },
      { id: 'a3', name: 'Cigarettes After Sex', popularity: 76 },
      { id: 'a4', name: 'Phoebe Bridgers', popularity: 72 },
      { id: 'a5', name: 'Daughter', popularity: 63 },
    ],
    topTracks: [
      { id: 't1', name: 'Slow Dancing in the Dark', popularity: 82, artists: ['Joji'] },
      { id: 't2', name: 'I Need My Girl', popularity: 74, artists: ['The National'] },
      { id: 't3', name: 'Apocalypse', popularity: 78, artists: ['Cigarettes After Sex'] },
      { id: 't4', name: 'Moon Song', popularity: 70, artists: ['Phoebe Bridgers'] },
      { id: 't5', name: 'Youth', popularity: 65, artists: ['Daughter'] },
    ],
    timeRange: {
      key: 'short_term',
      label: 'Short term',
      description: 'Approximately the last 4 weeks',
    },
    updatedAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
  },
};

export function getPresetFromQuery(value: string | null): HousePreset {
  if (value === 'hype' || value === 'sad' || value === 'calm') {
    return value;
  }
  return 'calm';
}

export function getDemoHouse(preset: HousePreset): HouseSpec {
  const base = PRESETS[preset];
  return {
    ...base,
    updatedAt: new Date().toISOString(),
  };
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function buildHouseSpecFromSpotify(input: {
  profile: {
    id: string;
    display_name: string | null;
    country?: string;
    product?: string;
    followers?: { total?: number };
    images?: Array<{ url: string }>;
  };
  artists: PagingObject<Artist>;
  tracks: PagingObject<Track>;
  timeRange: 'short_term' | 'medium_term' | 'long_term';
}): HouseSpec {
  const profile = input.profile;
  const timeRangeKey = input.timeRange;
  const timeRangeLabel =
    timeRangeKey === 'short_term'
      ? 'Short term'
      : timeRangeKey === 'medium_term'
      ? 'Medium term'
      : 'Long term';
  const timeRangeDescription =
    timeRangeKey === 'short_term'
      ? 'Approximately the last 4 weeks'
      : timeRangeKey === 'medium_term'
      ? 'Approximately the last 6 months'
      : 'Approximately the last several years';
  const artistItems = input.artists.items ?? [];
  const trackItems = input.tracks.items ?? [];

  const avgTrackPopularity =
    trackItems.reduce((sum, track) => sum + (track.popularity ?? 0), 0) /
    Math.max(trackItems.length, 1);
  const avgArtistPopularity =
    artistItems.reduce((sum, artist) => sum + (artist.popularity ?? 0), 0) /
    Math.max(artistItems.length, 1);

  const energy = clamp01(avgTrackPopularity / 100);
  const valence = clamp01(avgArtistPopularity / 100);

  const genreCounts = new Map<string, number>();
  for (const artist of artistItems) {
    for (const genre of artist.genres ?? []) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const totalGenres = Array.from(genreCounts.values()).reduce((sum, count) => sum + count, 0);
  const maxGenre = totalGenres
    ? Math.max(...Array.from(genreCounts.values()))
    : 0;
  const genreDominance = totalGenres ? clamp01(maxGenre / totalGenres) : 0.5;
  const diversity = totalGenres ? clamp01(1 - genreDominance) : 0.5;

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const topGenreTotal = topGenres.reduce((sum, [, count]) => sum + count, 0);
  const genreWeights: Record<string, number> = {};
  if (topGenreTotal > 0) {
    for (const [genre, count] of topGenres) {
      genreWeights[genre] = clamp01(count / topGenreTotal);
    }
  }
  const [topGenre, topGenreCount] = topGenres[0] ?? [null, 0];

  const tempo = Math.round(60 + energy * 120);
  const intensity = clamp01(0.3 + energy * 0.6 + trackItems.length / 100);

  return {
    energy,
    valence,
    tempo,
    genreDominance,
    diversity,
    intensity,
    genreWeights,
    topArtistCount: artistItems.length,
    topTrackCount: trackItems.length,
    uniqueGenreCount: genreCounts.size,
    topGenre,
    topGenreWeight: topGenreTotal ? clamp01(topGenreCount / topGenreTotal) : 0,
    avgArtistPopularity: Math.round(avgArtistPopularity),
    avgTrackPopularity: Math.round(avgTrackPopularity),
    userProfile: {
      id: profile.id,
      displayName: profile.display_name ?? 'Spotify Listener',
      country: profile.country ?? null,
      product: profile.product ?? null,
      followers: profile.followers?.total ?? null,
      imageUrl: profile.images?.[0]?.url ?? null,
    },
    topArtists: artistItems.slice(0, 5).map((artist) => ({
      id: artist.id,
      name: artist.name,
      popularity: artist.popularity ?? 0,
    })),
    topTracks: trackItems.slice(0, 5).map((track) => ({
      id: track.id,
      name: track.name,
      popularity: track.popularity ?? 0,
      artists: track.artists?.map((artist) => artist.name) ?? [],
    })),
    timeRange: {
      key: timeRangeKey,
      label: timeRangeLabel,
      description: timeRangeDescription,
    },
    updatedAt: new Date().toISOString(),
  };
}
