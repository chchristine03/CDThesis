import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Type definitions based on Spotify Web API
export type TopItemType = 'artists' | 'tracks';
export type TimeRange = 'long_term' | 'medium_term' | 'short_term';

export interface ExternalUrls {
  spotify: string;
}

export interface Image {
  url: string;
  height: number | null;
  width: number | null;
}

export interface Followers {
  href: string | null;
  total: number;
}

export interface SimplifiedArtist {
  external_urls: ExternalUrls;
  href: string;
  id: string;
  name: string;
  type: 'artist';
  uri: string;
}

export interface Artist {
  external_urls: ExternalUrls;
  followers: Followers;
  genres: string[];
  href: string;
  id: string;
  images: Image[];
  name: string;
  popularity: number;
  type: 'artist';
  uri: string;
}

export interface Album {
  album_type: string;
  total_tracks: number;
  available_markets: string[];
  external_urls: ExternalUrls;
  href: string;
  id: string;
  images: Image[];
  name: string;
  release_date: string;
  release_date_precision: string;
  restrictions?: {
    reason: string;
  };
  type: 'album';
  uri: string;
  artists: SimplifiedArtist[];
}

export interface Track {
  album: Album;
  artists: SimplifiedArtist[];
  available_markets: string[];
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_ids: {
    isrc?: string;
    ean?: string;
    upc?: string;
  };
  external_urls: ExternalUrls;
  href: string;
  id: string;
  is_playable?: boolean;
  linked_from?: {
    external_urls: ExternalUrls;
    href: string;
    id: string;
    type: string;
    uri: string;
  };
  restrictions?: {
    reason: string;
  };
  name: string;
  popularity: number;
  preview_url: string | null;
  track_number: number;
  type: 'track';
  uri: string;
  is_local: boolean;
}

export interface RecentlyPlayedItem {
  track: Track;
  played_at: string;
}

export interface SavedTrackItem {
  added_at: string;
  track: Track;
}

export type TopItem = Artist | Track;

export interface PagingObject<T> {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
  items: T[];
}

export interface GetTopItemsParams {
  type: TopItemType;
  time_range?: TimeRange;
  limit?: number;
  offset?: number;
}

// Playlist types
export interface SimplifiedPlaylist {
  collaborative: boolean;
  description: string | null;
  external_urls: ExternalUrls;
  href: string;
  id: string;
  images: Image[];
  name: string;
  owner: {
    external_urls: ExternalUrls;
    followers?: Followers;
    href: string;
    id: string;
    type: 'user';
    uri: string;
    display_name?: string | null;
  };
  public: boolean | null;
  snapshot_id: string;
  tracks: {
    href: string;
    total: number;
  };
  type: 'playlist';
  uri: string;
}

export interface PlaylistItem {
  added_at: string | null;
  added_by: {
    external_urls: ExternalUrls;
    href: string;
    id: string;
    type: 'user';
    uri: string;
  } | null;
  is_local: boolean;
  track: Track | null;
}

// Analysis result types
export interface ArtistFrequency {
  artistId: string;
  artistName: string;
  count: number;
  percentage: number;
  sources: {
    playlists: number;
    savedTracks: number;
    topTracks: number;
  };
}

export interface GenreFrequency {
  genre: string;
  count: number;
  percentage: number;
  artists: string[];
}

export interface TrackFrequency {
  trackId: string;
  trackName: string;
  artistNames: string[];
  count: number;
  percentage: number;
}

export interface ListeningAnalysis {
  totalTracks: number;
  totalArtists: number;
  totalGenres: number;
  artistFrequencies: ArtistFrequency[];
  genreFrequencies: GenreFrequency[];
  trackFrequencies: TrackFrequency[];
  sources: {
    playlists: number;
    savedTracks: number;
    topTracks: number;
  };
}

export interface UserProfile {
  country: string;
  display_name: string | null;
  email?: string;
  explicit_content?: {
    filter_enabled: boolean;
    filter_locked: boolean;
  };
  external_urls: ExternalUrls;
  followers: Followers;
  href: string;
  id: string;
  images: Image[];
  product: string;
  type: 'user';
  uri: string;
}

export interface SearchResult {
  track: Track;
  playlistId: string;
  playlistName: string;
}

export class SpotifyClient {
  private api: AxiosInstance;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.api = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Helper method to sleep/delay execution
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper method to retry API calls with exponential backoff for rate limiting
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: unknown;
    
    // Maximum delay cap: 5 seconds (to avoid extremely long waits)
    const MAX_DELAY_MS = 5 * 1000;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          
          // If it's a 429 (rate limit), retry with exponential backoff
          if (status === 429) {
            const retryAfter = error.response?.headers['retry-after'];
            let delay: number;
            
            if (retryAfter) {
              // Use Retry-After header, but cap it at MAX_DELAY_MS
              delay = Math.min(parseInt(retryAfter, 10) * 1000, MAX_DELAY_MS);
            } else {
              // Exponential backoff with cap
              delay = Math.min(initialDelay * Math.pow(2, attempt), MAX_DELAY_MS);
            }
            
            if (attempt < maxRetries - 1) {
              const delaySeconds = Math.ceil(delay / 1000);
              console.warn(
                `Rate limited (429). Retrying in ${delaySeconds}s... (attempt ${attempt + 1}/${maxRetries})`
              );
              await this.sleep(delay);
              continue;
            }
          }
          
          // If it's not a 429 or we've exhausted retries, throw
          throw error;
        }
        
        // If it's not an axios error, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Helper method to handle API errors with helpful messages
   */
  private handleApiError(error: unknown, operation: string = 'API call'): never {
    if (axios.isAxiosError(error)) {
      const spotifyError = error.response?.data?.error;
      const status = error.response?.status ?? spotifyError?.status;
      const errorMessage = spotifyError?.message || error.message;

      if (status !== undefined) {
        console.error(`Spotify API error code: ${status}, message: ${errorMessage}`);
      } else {
        console.error('Spotify API error code: unknown');
      }
      
      if (status === 403 && errorMessage?.toLowerCase().includes('scope')) {
        throw new Error(
          `Spotify API Error (${operation}): ${status} - Insufficient client scope\n\n` +
          `Required scopes:\n` +
          `  - user-top-read (for top artists/tracks)\n` +
          `  - playlist-read-private (for playlists)\n` +
          `  - user-library-read (for saved tracks)\n` +
          `  - user-read-recently-played (for recently played)\n\n` +
          `Get a new token with these scopes at:\n` +
          `  https://developer.spotify.com/console/get-users-top-artists-and-tracks/\n` +
          `  Click "Get Token" and select all required scopes.`
        );
      }
      
      if (status === 429) {
        const retryAfter = error.response?.headers['retry-after'];
        throw new Error(
          `Spotify API Error (${operation}): ${status} - Rate limit exceeded. ` +
          (retryAfter
            ? `Please wait ${retryAfter} seconds before retrying.`
            : `Too many requests. Please wait before retrying.`)
        );
      }
      
      throw new Error(
        `Spotify API Error (${operation}): ${status} - ${errorMessage}`
      );
    }
    throw error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Get the current user's top artists or tracks
   * @param params - Query parameters for the request
   * @returns Promise with paging object containing top items
   */
  async getTopItems(params: GetTopItemsParams): Promise<PagingObject<TopItem>> {
    const { type, time_range = 'medium_term', limit = 20, offset = 0 } = params;
    try {
      const response: AxiosResponse<PagingObject<TopItem>> = await this.retryWithBackoff(
        () =>
          this.api.get(`/me/top/${type}`, {
            params: {
              time_range,
              limit,
              offset,
            },
          })
      );

      return response.data;
    } catch (error: unknown) {
      this.handleApiError(error, 'getTopItems');
    }
  }

  /**
   * Get the current user's top artists
   */
  async getTopArtists(
    time_range?: TimeRange,
    limit?: number,
    offset?: number
  ): Promise<PagingObject<Artist>> {
    return this.getTopItems({ type: 'artists', time_range, limit, offset }) as Promise<
      PagingObject<Artist>
    >;
  }

  /**
   * Get the current user's top tracks
   */
  async getTopTracks(
    time_range?: TimeRange,
    limit?: number,
    offset?: number
  ): Promise<PagingObject<Track>> {
    return this.getTopItems({ type: 'tracks', time_range, limit, offset }) as Promise<
      PagingObject<Track>
    >;
  }

  /**
   * Get the current user's profile
   */
  async getCurrentUserProfile(): Promise<UserProfile> {
    try {
      const response: AxiosResponse<UserProfile> = await this.retryWithBackoff(() =>
        this.api.get('/me')
      );
      return response.data;
    } catch (error: unknown) {
      this.handleApiError(error, 'getCurrentUserProfile');
    }
  }

  /**
   * Get all playlists owned by the current user
   * Filters out playlists owned by other users
   */
  async getMyPlaylists(limit = 50): Promise<SimplifiedPlaylist[]> {
    const allPlaylists = await this.getAllPlaylists(limit);
    const currentUser = await this.getCurrentUserProfile();
    
    // Filter playlists where owner.id matches current user's id
    return allPlaylists.filter(
      (playlist) => playlist.owner.id === currentUser.id
    );
  }

  /**
   * Get all of the current user's playlists (including ones they follow)
   * Automatically handles pagination to get all playlists
   */
  async getAllPlaylists(limit = 50): Promise<SimplifiedPlaylist[]> {
    try {
      const allPlaylists: SimplifiedPlaylist[] = [];
      let offset = 0;
      let hasNext = true;

      while (hasNext) {
        const response: AxiosResponse<PagingObject<SimplifiedPlaylist>> =
          await this.retryWithBackoff(() =>
            this.api.get('/me/playlists', {
              params: { limit, offset },
            })
          );

        allPlaylists.push(...response.data.items);
        hasNext = response.data.next !== null;
        offset += limit;
        
        // Small delay between pagination requests
        if (hasNext) {
          await this.sleep(100);
        }
      }

      return allPlaylists;
    } catch (error: unknown) {
      this.handleApiError(error, 'getAllPlaylists');
    }
  }

  /**
   * Get all tracks from a playlist
   * Automatically handles pagination to get all tracks
   */
  async getPlaylistTracks(
    playlistId: string,
    limit = 50,
    market?: string
  ): Promise<Track[]> {
    try {
      const allTracks: Track[] = [];
      let offset = 0;
      let hasNext = true;

      while (hasNext) {
        const params: Record<string, string | number> = { limit, offset };
        if (market) {
          params.market = market;
        }

        const response: AxiosResponse<PagingObject<PlaylistItem>> =
          await this.retryWithBackoff(() =>
            this.api.get(`/playlists/${playlistId}/tracks`, { params })
          );

        // Filter out null tracks and local tracks
        const validTracks = response.data.items
          .filter((item) => item.track !== null && !item.track.is_local)
          .map((item) => item.track as Track);

        allTracks.push(...validTracks);
        hasNext = response.data.next !== null;
        offset += limit;
        
        // Small delay between pagination requests
        if (hasNext) {
          await this.sleep(100);
        }
      }

      return allTracks;
    } catch (error: unknown) {
      this.handleApiError(error, 'getPlaylistTracks');
    }
  }

  /**
   * Get all saved tracks of the current user
   * Automatically handles pagination to get all saved tracks
   */
  async getSavedTracks(limit = 50, market?: string): Promise<Track[]> {
    try {
      const allTracks: Track[] = [];
      let offset = 0;
      let hasNext = true;

      while (hasNext) {
        const params: Record<string, string | number> = { limit, offset };
        if (market) {
          params.market = market;
        }

        const response: AxiosResponse<
          PagingObject<{ added_at: string; track: Track }>
        > = await this.retryWithBackoff(() =>
          this.api.get('/me/tracks', { params })
        );

        allTracks.push(...response.data.items.map((item) => item.track));
        hasNext = response.data.next !== null;
        offset += limit;
        
        // Small delay between pagination requests
        if (hasNext) {
          await this.sleep(100);
        }
      }

      return allTracks;
    } catch (error: unknown) {
      this.handleApiError(error, 'getSavedTracks');
    }
  }

  /**
   * Get all saved tracks with added_at timestamps
   */
  async getSavedTracksWithAddedAt(limit = 50, market?: string): Promise<SavedTrackItem[]> {
    try {
      const allTracks: SavedTrackItem[] = [];
      let offset = 0;
      let hasNext = true;

      while (hasNext) {
        const params: Record<string, string | number> = { limit, offset };
        if (market) {
          params.market = market;
        }

        const response: AxiosResponse<PagingObject<SavedTrackItem>> =
          await this.retryWithBackoff(() => this.api.get('/me/tracks', { params }));

        allTracks.push(...response.data.items);
        hasNext = response.data.next !== null;
        offset += limit;

        if (hasNext) {
          await this.sleep(100);
        }
      }

      return allTracks;
    } catch (error: unknown) {
      this.handleApiError(error, 'getSavedTracksWithAddedAt');
    }
  }

  /**
   * Get recently played tracks for the current user
   */
  async getRecentlyPlayed(limit = 50): Promise<RecentlyPlayedItem[]> {
    try {
      const response: AxiosResponse<{ items: RecentlyPlayedItem[] }> =
        await this.retryWithBackoff(() =>
          this.api.get('/me/player/recently-played', { params: { limit } })
        );

      return response.data.items;
    } catch (error: unknown) {
      this.handleApiError(error, 'getRecentlyPlayed');
    }
  }

  /**
   * Get the largest playlist(s) by track count
   * @param count - Number of largest playlists to return (default: 1)
   */
  async getLargestPlaylists(count: number = 1): Promise<SimplifiedPlaylist[]> {
    const playlists = await this.getAllPlaylists();
    
    // Sort by track count (descending) and return top N
    const sorted = playlists.sort((a, b) => b.tracks.total - a.tracks.total);
    return sorted.slice(0, count);
  }

  /**
   * Get tracks from specific playlists
   * @param playlistIds - Array of playlist IDs to fetch tracks from
   */
  async getTracksFromPlaylists(playlistIds: string[]): Promise<Map<string, Track[]>> {
    const playlistTracksMap = new Map<string, Track[]>();

    console.log(`📋 Processing ${playlistIds.length} playlist(s)...`);
    
    for (let i = 0; i < playlistIds.length; i++) {
      const playlistId = playlistIds[i];
      try {
        const tracks = await this.getPlaylistTracks(playlistId);
        playlistTracksMap.set(playlistId, tracks);
        console.log(`   ✓ Processed playlist ${i + 1}/${playlistIds.length} (${tracks.length} tracks)`);
        
        // Delay between playlist requests to avoid rate limiting
        if (i < playlistIds.length - 1) {
          await this.sleep(300);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to get tracks for playlist: ${error instanceof Error ? error.message : error}`);
        playlistTracksMap.set(playlistId, []);
        
        // If we hit a rate limit, wait longer before continuing
        if (error instanceof Error && error.message.includes('429')) {
          console.log('   ⏳ Rate limit hit. Waiting 5 seconds before continuing...');
          await this.sleep(5000);
        }
      }
    }

    return playlistTracksMap;
  }

  /**
   * Get all tracks from all user's playlists
   * Returns a map of playlist ID to tracks array
   * Processes playlists sequentially with delays to avoid rate limits
   */
  async getAllTracksFromAllPlaylists(): Promise<Map<string, Track[]>> {
    const playlists = await this.getAllPlaylists();
    const playlistIds = playlists.map(p => p.id);
    return this.getTracksFromPlaylists(playlistIds);
  }

  /**
   * Analyze artist frequency across playlists, saved tracks, and top tracks
   */
  async analyzeArtistFrequency(options?: {
    includePlaylists?: boolean;
    includeSavedTracks?: boolean;
    includeTopTracks?: boolean;
    topTracksLimit?: number;
    playlistIds?: string[]; // Specific playlist IDs to analyze (if not provided, analyzes all)
    largestPlaylistCount?: number; // Analyze only the N largest playlists
  }): Promise<ArtistFrequency[]> {
    const {
      includePlaylists = true,
      includeSavedTracks = true,
      includeTopTracks = true,
      topTracksLimit = 50,
      playlistIds,
      largestPlaylistCount,
    } = options || {};

    const artistMap = new Map<
      string,
      { name: string; count: number; sources: { playlists: number; savedTracks: number; topTracks: number } }
    >();

    // Collect tracks from all sources
    if (includePlaylists) {
      let playlistTracksMap: Map<string, Track[]>;
      
      if (largestPlaylistCount) {
        // Analyze only the largest playlists
        const largestPlaylists = await this.getLargestPlaylists(largestPlaylistCount);
        const ids = largestPlaylists.map(p => p.id);
        console.log(`📊 Analyzing ${largestPlaylistCount} largest playlist(s): ${largestPlaylists.map(p => p.name).join(', ')}`);
        playlistTracksMap = await this.getTracksFromPlaylists(ids);
      } else if (playlistIds && playlistIds.length > 0) {
        // Analyze specific playlists
        playlistTracksMap = await this.getTracksFromPlaylists(playlistIds);
      } else {
        // Analyze all playlists
        playlistTracksMap = await this.getAllTracksFromAllPlaylists();
      }
      for (const tracks of playlistTracksMap.values()) {
        for (const track of tracks) {
          for (const artist of track.artists) {
            if (!artistMap.has(artist.id)) {
              artistMap.set(artist.id, {
                name: artist.name,
                count: 0,
                sources: { playlists: 0, savedTracks: 0, topTracks: 0 },
              });
            }
            const artistData = artistMap.get(artist.id)!;
            artistData.count++;
            artistData.sources.playlists++;
          }
        }
      }
    }

    if (includeSavedTracks) {
      const savedTracks = await this.getSavedTracks();
      for (const track of savedTracks) {
        for (const artist of track.artists) {
          if (!artistMap.has(artist.id)) {
            artistMap.set(artist.id, {
              name: artist.name,
              count: 0,
              sources: { playlists: 0, savedTracks: 0, topTracks: 0 },
            });
          }
          const artistData = artistMap.get(artist.id)!;
          artistData.count++;
          artistData.sources.savedTracks++;
        }
      }
    }

    if (includeTopTracks) {
      const allTopTracks: Track[] = [];
      let offset = 0;
      while (allTopTracks.length < topTracksLimit) {
        const response = await this.getTopTracks('medium_term', 50, offset);
        allTopTracks.push(...response.items);
        if (!response.next || allTopTracks.length >= topTracksLimit) break;
        offset += 50;
      }

      for (const track of allTopTracks.slice(0, topTracksLimit)) {
        for (const artist of track.artists) {
          if (!artistMap.has(artist.id)) {
            artistMap.set(artist.id, {
              name: artist.name,
              count: 0,
              sources: { playlists: 0, savedTracks: 0, topTracks: 0 },
            });
          }
          const artistData = artistMap.get(artist.id)!;
          artistData.count++;
          artistData.sources.topTracks++;
        }
      }
    }

    // Calculate total and percentages
    const total = Array.from(artistMap.values()).reduce((sum, a) => sum + a.count, 0);

    const frequencies: ArtistFrequency[] = Array.from(artistMap.entries()).map(
      ([artistId, data]) => ({
        artistId,
        artistName: data.name,
        count: data.count,
        percentage: total > 0 ? (data.count / total) * 100 : 0,
        sources: data.sources,
      })
    );

    return frequencies.sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze genre frequency across playlists, saved tracks, and top artists
   * Note: Genres come from artist data, so we need to fetch artist details
   */
  async analyzeGenreFrequency(options?: {
    includePlaylists?: boolean;
    includeSavedTracks?: boolean;
    includeTopArtists?: boolean;
    topArtistsLimit?: number;
    playlistIds?: string[];
    largestPlaylistCount?: number;
  }): Promise<GenreFrequency[]> {
    const {
      includePlaylists = true,
      includeSavedTracks = true,
      includeTopArtists = true,
      topArtistsLimit = 50,
      playlistIds,
      largestPlaylistCount,
    } = options || {};

    const genreMap = new Map<string, { count: number; artists: Set<string> }>();
    const artistIds = new Set<string>();

    // Collect unique artist IDs from all sources
    if (includePlaylists) {
      let playlistTracksMap: Map<string, Track[]>;
      
      if (largestPlaylistCount) {
        const largestPlaylists = await this.getLargestPlaylists(largestPlaylistCount);
        const ids = largestPlaylists.map(p => p.id);
        console.log(`📊 Analyzing ${largestPlaylistCount} largest playlist(s): ${largestPlaylists.map(p => p.name).join(', ')}`);
        playlistTracksMap = await this.getTracksFromPlaylists(ids);
      } else if (playlistIds && playlistIds.length > 0) {
        playlistTracksMap = await this.getTracksFromPlaylists(playlistIds);
      } else {
        playlistTracksMap = await this.getAllTracksFromAllPlaylists();
      }
      for (const tracks of playlistTracksMap.values()) {
        for (const track of tracks) {
          for (const artist of track.artists) {
            artistIds.add(artist.id);
          }
        }
      }
    }

    if (includeSavedTracks) {
      const savedTracks = await this.getSavedTracks();
      for (const track of savedTracks) {
        for (const artist of track.artists) {
          artistIds.add(artist.id);
        }
      }
    }

    if (includeTopArtists) {
      const allTopArtists: Artist[] = [];
      let offset = 0;
      while (allTopArtists.length < topArtistsLimit) {
        const response = await this.getTopArtists('medium_term', 50, offset);
        allTopArtists.push(...response.items);
        if (!response.next || allTopArtists.length >= topArtistsLimit) break;
        offset += 50;
      }

      for (const artist of allTopArtists.slice(0, topArtistsLimit)) {
        artistIds.add(artist.id);
        // Use genres directly from top artists response
        for (const genre of artist.genres) {
          if (!genreMap.has(genre)) {
            genreMap.set(genre, { count: 0, artists: new Set() });
          }
          const genreData = genreMap.get(genre)!;
          genreData.count++;
          genreData.artists.add(artist.name);
        }
      }
    }

    // Fetch artist details for remaining artists (batch API call)
    const artistIdArray = Array.from(artistIds);
    const batchSize = 50;
    console.log(`   Fetching genre data for ${artistIdArray.length} artists...`);
    
    for (let i = 0; i < artistIdArray.length; i += batchSize) {
      const batch = artistIdArray.slice(i, i + batchSize);
      try {
        const response = await this.retryWithBackoff(() =>
          this.api.get('/artists', {
            params: { ids: batch.join(',') },
          })
        );
        const artists: Artist[] = response.data.artists;
        for (const artist of artists) {
          if (artist && artist.genres) {
            for (const genre of artist.genres) {
              if (!genreMap.has(genre)) {
                genreMap.set(genre, { count: 0, artists: new Set() });
              }
              const genreData = genreMap.get(genre)!;
              genreData.count++;
              genreData.artists.add(artist.name);
            }
          }
        }
        
        // Delay between batch requests
        if (i + batchSize < artistIdArray.length) {
          await this.sleep(300);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to fetch artist details for batch: ${error instanceof Error ? error.message : error}`);
        // Continue with next batch even if this one fails
      }
    }

    // Calculate total and percentages
    const total = Array.from(genreMap.values()).reduce((sum, g) => sum + g.count, 0);

    const frequencies: GenreFrequency[] = Array.from(genreMap.entries()).map(
      ([genre, data]) => ({
        genre,
        count: data.count,
        percentage: total > 0 ? (data.count / total) * 100 : 0,
        artists: Array.from(data.artists),
      })
    );

    return frequencies.sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze track frequency across playlists and saved tracks
   */
  async analyzeTrackFrequency(options?: {
    includePlaylists?: boolean;
    includeSavedTracks?: boolean;
    playlistIds?: string[];
    largestPlaylistCount?: number;
  }): Promise<TrackFrequency[]> {
    const {
      includePlaylists = true,
      includeSavedTracks = true,
      playlistIds,
      largestPlaylistCount,
    } = options || {};

    const trackMap = new Map<
      string,
      { name: string; artistNames: string[]; count: number }
    >();

    if (includePlaylists) {
      let playlistTracksMap: Map<string, Track[]>;
      
      if (largestPlaylistCount) {
        const largestPlaylists = await this.getLargestPlaylists(largestPlaylistCount);
        const ids = largestPlaylists.map(p => p.id);
        console.log(`📊 Analyzing ${largestPlaylistCount} largest playlist(s): ${largestPlaylists.map(p => p.name).join(', ')}`);
        playlistTracksMap = await this.getTracksFromPlaylists(ids);
      } else if (playlistIds && playlistIds.length > 0) {
        playlistTracksMap = await this.getTracksFromPlaylists(playlistIds);
      } else {
        playlistTracksMap = await this.getAllTracksFromAllPlaylists();
      }
      for (const tracks of playlistTracksMap.values()) {
        for (const track of tracks) {
          if (!trackMap.has(track.id)) {
            trackMap.set(track.id, {
              name: track.name,
              artistNames: track.artists.map((a) => a.name),
              count: 0,
            });
          }
          trackMap.get(track.id)!.count++;
        }
      }
    }

    if (includeSavedTracks) {
      const savedTracks = await this.getSavedTracks();
      for (const track of savedTracks) {
        if (!trackMap.has(track.id)) {
          trackMap.set(track.id, {
            name: track.name,
            artistNames: track.artists.map((a) => a.name),
            count: 0,
          });
        }
        trackMap.get(track.id)!.count++;
      }
    }

    // Calculate total and percentages
    const total = Array.from(trackMap.values()).reduce((sum, t) => sum + t.count, 0);

    const frequencies: TrackFrequency[] = Array.from(trackMap.entries()).map(
      ([trackId, data]) => ({
        trackId,
        trackName: data.name,
        artistNames: data.artistNames,
        count: data.count,
        percentage: total > 0 ? (data.count / total) * 100 : 0,
      })
    );

    return frequencies.sort((a, b) => b.count - a.count);
  }

  /**
   * Comprehensive listening analysis combining all data sources
   */
  async analyzeListeningData(options?: {
    includePlaylists?: boolean;
    includeSavedTracks?: boolean;
    includeTopTracks?: boolean;
    includeTopArtists?: boolean;
    topItemsLimit?: number;
    playlistIds?: string[];
    largestPlaylistCount?: number;
  }): Promise<ListeningAnalysis> {
    const {
      includePlaylists = true,
      includeSavedTracks = true,
      includeTopTracks = true,
      includeTopArtists = true,
      topItemsLimit = 50,
      playlistIds,
      largestPlaylistCount,
    } = options || {};

    // Get all analyses in parallel
    const [artistFrequencies, genreFrequencies, trackFrequencies] = await Promise.all([
      this.analyzeArtistFrequency({
        includePlaylists,
        includeSavedTracks,
        includeTopTracks,
        topTracksLimit: topItemsLimit,
        playlistIds,
        largestPlaylistCount,
      }),
      this.analyzeGenreFrequency({
        includePlaylists,
        includeSavedTracks,
        includeTopArtists,
        topArtistsLimit: topItemsLimit,
        playlistIds,
        largestPlaylistCount,
      }),
      this.analyzeTrackFrequency({
        includePlaylists,
        includeSavedTracks,
        playlistIds,
        largestPlaylistCount,
      }),
    ]);

    // Calculate source counts
    const sources = {
      playlists: includePlaylists
        ? (await this.getAllPlaylists()).length
        : 0,
      savedTracks: includeSavedTracks
        ? (await this.getSavedTracks()).length
        : 0,
      topTracks: includeTopTracks ? topItemsLimit : 0,
    };

    return {
      totalTracks: trackFrequencies.reduce((sum, t) => sum + t.count, 0),
      totalArtists: artistFrequencies.length,
      totalGenres: genreFrequencies.length,
      artistFrequencies,
      genreFrequencies,
      trackFrequencies,
      sources,
    };
  }

  /**
   * Search for tracks across all playlists owned by the current user
   * @param query - Search query (searches in track name and artist names)
   * @param options - Search options
   */
  async searchMyPlaylists(
    query: string,
    options?: {
      caseSensitive?: boolean;
      matchExact?: boolean;
    }
  ): Promise<SearchResult[]> {
    const { caseSensitive = false, matchExact = false } = options || {};
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const results: SearchResult[] = [];

    // Get all playlists owned by current user
    const myPlaylists = await this.getMyPlaylists();
    console.log(`🔍 Searching across ${myPlaylists.length} of your playlists for: "${query}"`);

    // Search through each playlist
    for (let i = 0; i < myPlaylists.length; i++) {
      const playlist = myPlaylists[i];
      try {
        const tracks = await this.getPlaylistTracks(playlist.id);
        
        for (const track of tracks) {
          const trackName = caseSensitive ? track.name : track.name.toLowerCase();
          const artistNames = track.artists
            .map((artist) => (caseSensitive ? artist.name : artist.name.toLowerCase()))
            .join(' ');
          const searchText = `${trackName} ${artistNames}`;

          let matches = false;
          if (matchExact) {
            // Exact match: track name or any artist name must exactly match
            matches =
              trackName === searchQuery ||
              track.artists.some((artist) => {
                const artistName = caseSensitive ? artist.name : artist.name.toLowerCase();
                return artistName === searchQuery;
              });
          } else {
            // Partial match: search query appears anywhere in track name or artist names
            matches = searchText.includes(searchQuery);
          }

          if (matches) {
            results.push({
              track,
              playlistId: playlist.id,
              playlistName: playlist.name,
            });
          }
        }

        // Progress indicator
        if ((i + 1) % 5 === 0 || i === myPlaylists.length - 1) {
          console.log(`   Searched ${i + 1}/${myPlaylists.length} playlists... Found ${results.length} matches so far`);
        }

        // Delay between playlists
        if (i < myPlaylists.length - 1) {
          await this.sleep(300);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to search playlist "${playlist.name}": ${error instanceof Error ? error.message : error}`);
      }
    }

    return results;
  }

  /**
   * Search for tracks by artist across all playlists owned by the current user
   */
  async searchMyPlaylistsByArtist(artistName: string): Promise<SearchResult[]> {
    return this.searchMyPlaylists(artistName, { matchExact: false });
  }

  /**
   * Search for a specific track across all playlists owned by the current user
   */
  async searchMyPlaylistsByTrack(trackName: string): Promise<SearchResult[]> {
    return this.searchMyPlaylists(trackName, { matchExact: false });
  }
}

