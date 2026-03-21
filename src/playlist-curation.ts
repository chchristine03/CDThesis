import axios, { type AxiosResponse } from 'axios';
import type { PagingObject, SimplifiedPlaylist, UserProfile } from './spotify-client';

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

export type PlaylistCurationLabel =
  | 'STREAMER'
  | 'WORLD_BUILDER'
  | 'POWER_CURATOR'
  | 'MICRO_CURATOR'
  | 'ARCHIVIST'
  | 'CASUAL_CURATOR'
  | null;

export interface PlaylistCurationStats {
  playlistCount: number;
  totalTracks: number;
  maxSize: number;
  oneBigShare: number;
  draftCount: number;
  microCount: number;
  mediumCount: number;
  largeCount: number;
  curatedCount: number;
  curatedRatio: number;
  substantialCount: number;
  substantialRatio: number;
  curatedAvgSize: number;
  substantialAvgSize: number;
}

export interface ExamplePlaylist {
  name: string;
  trackCount: number;
}

export interface LargestPlaylist {
  name: string;
  trackCount: number;
}

export interface PlaylistCurationResult {
  label: PlaylistCurationLabel;
  stats: PlaylistCurationStats;
  examplePlaylists: ExamplePlaylist[];
  largestPlaylist: LargestPlaylist | null;
}

async function fetchCurrentUserId(token: string): Promise<string> {
  const url = `${SPOTIFY_API_BASE_URL}/me`;

  const response = await axios.get<UserProfile>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data.id;
}

async function fetchUserPlaylists(
  token: string,
  maxPlaylists: number = 200,
  pageLimit: number = 50
): Promise<SimplifiedPlaylist[]> {
  const playlists: SimplifiedPlaylist[] = [];

  let nextUrl: string | null = `${SPOTIFY_API_BASE_URL}/me/playlists?limit=${pageLimit}`;

  while (nextUrl && playlists.length < maxPlaylists) {
    const response: AxiosResponse<PagingObject<SimplifiedPlaylist>> =
      await axios.get<PagingObject<SimplifiedPlaylist>>(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

    playlists.push(...response.data.items);

    if (!response.data.next || playlists.length >= maxPlaylists) {
      break;
    }

    nextUrl = response.data.next;
  }

  return playlists.slice(0, maxPlaylists);
}

export async function computePlaylistCuration(
  token: string
): Promise<PlaylistCurationResult> {
  const emptyStats: PlaylistCurationStats = {
    playlistCount: 0,
    totalTracks: 0,
    maxSize: 0,
    oneBigShare: 0,
    draftCount: 0,
    microCount: 0,
    mediumCount: 0,
    largeCount: 0,
    curatedCount: 0,
    curatedRatio: 0,
    substantialCount: 0,
    substantialRatio: 0,
    curatedAvgSize: 0,
    substantialAvgSize: 0,
  };

  try {
    const [userId, playlists] = await Promise.all([
      fetchCurrentUserId(token),
      fetchUserPlaylists(token),
    ]);

    const ownedPlaylists = playlists.filter(
      (playlist) => playlist.owner?.id === userId
    );

    const playlistsWithTracks = ownedPlaylists.filter(
      (p) => (p.tracks?.total ?? 0) > 0
    );
    const playlistCount = playlistsWithTracks.length;
    const sizes = playlistsWithTracks.map((p) => p.tracks?.total ?? 0);

    const totalTracks = sizes.reduce((sum, size) => sum + size, 0);
    const maxSize = sizes.length ? Math.max(...sizes) : 0;
    const oneBigShare = totalTracks > 0 ? maxSize / totalTracks : 0;

    const draftCount = sizes.filter((size) => size < 5).length;
    const microCount = sizes.filter(
      (size) => size >= 5 && size < 20
    ).length;
    const mediumCount = sizes.filter(
      (size) => size >= 20 && size < 80
    ).length;
    const largeCount = sizes.filter((size) => size >= 80).length;

    const curatedPlaylists = playlistsWithTracks.filter(
      (p) => (p.tracks?.total ?? 0) >= 5
    );
    const curatedCount = curatedPlaylists.length;
    const curatedRatio =
      playlistCount > 0 ? curatedCount / playlistCount : 0;

    const substantialPlaylists = playlistsWithTracks.filter(
      (p) => (p.tracks?.total ?? 0) >= 20
    );
    const substantialCount = substantialPlaylists.length;
    const substantialRatio =
      playlistCount > 0 ? substantialCount / playlistCount : 0;

    const curatedTotal = curatedPlaylists.reduce(
      (sum, p) => sum + (p.tracks?.total ?? 0),
      0
    );
    const curatedAvgSize =
      curatedCount > 0 ? curatedTotal / curatedCount : 0;

    const substantialTotal = substantialPlaylists.reduce(
      (sum, p) => sum + (p.tracks?.total ?? 0),
      0
    );
    const substantialAvgSize =
      substantialCount > 0 ? substantialTotal / substantialCount : 0;

    const stats: PlaylistCurationStats = {
      playlistCount,
      totalTracks,
      maxSize,
      oneBigShare,
      draftCount,
      microCount,
      mediumCount,
      largeCount,
      curatedCount,
      curatedRatio,
      substantialCount,
      substantialRatio,
      curatedAvgSize,
      substantialAvgSize,
    };

    let label: PlaylistCurationLabel;

    if (playlistCount < 3) {
      label = 'STREAMER';
    } else if (oneBigShare >= 0.35) {
      label = 'WORLD_BUILDER';
    } else if (largeCount >= 2 && substantialCount <= 6) {
      label = 'WORLD_BUILDER';
    } else if (
      playlistCount >= 35 &&
      totalTracks >= 1500 &&
      substantialCount >= 15
    ) {
      label = 'POWER_CURATOR';
    } else if (
      microCount >= 12 &&
      (microCount / playlistCount) >= 0.35 &&
      substantialRatio < 0.45
    ) {
      label = 'MICRO_CURATOR';
    } else if (playlistCount >= 12 && substantialCount >= 8) {
      label = 'ARCHIVIST';
    } else {
      label = 'CASUAL_CURATOR';
    }

    const toExample = (p: SimplifiedPlaylist): ExamplePlaylist => ({
      name: p.name ?? '',
      trackCount: p.tracks?.total ?? 0,
    });

    const bySize = [...playlistsWithTracks].sort(
      (a, b) => (b.tracks?.total ?? 0) - (a.tracks?.total ?? 0)
    );
    const largestPlaylist: LargestPlaylist | null =
      bySize[0]
        ? { name: bySize[0].name ?? '', trackCount: bySize[0].tracks?.total ?? 0 }
        : null;

    let examplePlaylists: ExamplePlaylist[] = [];
    if (label === 'MICRO_CURATOR') {
      const microPlaylists = playlistsWithTracks.filter((p) => {
        const n = p.tracks?.total ?? 0;
        return n >= 5 && n < 20;
      });
      examplePlaylists = microPlaylists.slice(0, 3).map(toExample);
    } else if (label === 'ARCHIVIST' || label === 'POWER_CURATOR') {
      examplePlaylists = substantialPlaylists.slice(0, 3).map(toExample);
    } else if (label === 'WORLD_BUILDER') {
      examplePlaylists = bySize.slice(0, 3).map(toExample);
    }

    return {
      label,
      stats,
      examplePlaylists,
      largestPlaylist,
    };
  } catch (error) {
    console.error('computePlaylistCuration failed', error);

    return {
      label: null,
      stats: emptyStats,
      examplePlaylists: [],
      largestPlaylist: null,
    };
  }
}
