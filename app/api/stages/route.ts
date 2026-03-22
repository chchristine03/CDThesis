import { NextRequest, NextResponse } from 'next/server';
import { SpotifyClient } from '../../../src/spotify-client';
import { computeRoutineDiscovery } from '../../../src/routine-discovery';
import { computePlaylistCuration } from '../../../src/playlist-curation';
import {
  getSpotifyAccessTokenForRequest,
  setSpotifyAuthCookies,
} from '../../../lib/spotify-auth';

type Stage2Label =
  | 'NO_ARTIST_TIES'
  | 'MIXED_ARTISTS'
  | 'ARTIST_FOCUSED'
  | 'ONE_ARTIST_OBSESSED'
  | null;

export async function GET(request: NextRequest) {
  const auth = await getSpotifyAccessTokenForRequest(request);
  if (!auth.accessToken) {
    return NextResponse.json(
      { error: 'Missing Spotify access token. Please login via /api/auth/login.' },
      { status: 401 }
    );
  }

  try {
    const client = new SpotifyClient(auth.accessToken);
    const [recent, topShort, topMedium, topLong, routine, curation] = await Promise.all([
      client.getRecentlyPlayed(50),
      client.getTopTracks('short_term', 50, 0),
      client.getTopTracks('medium_term', 50, 0),
      client.getTopTracks('long_term', 50, 0),
      computeRoutineDiscovery(auth.accessToken),
      computePlaylistCuration(auth.accessToken),
    ]);

    // Stage 2: Identity vs Diversity + artist frequency (tracks containing artist)
    const artistIds = new Set<string>();
    const artistTrackCounts = new Map<string, { name: string; count: number }>();
    const topTracks = topShort.items ?? [];
    const topTracksCount = topTracks.length;

    for (const track of topTracks) {
      const seenOnThisTrack = new Set<string>();
      for (const artist of track.artists ?? []) {
        artistIds.add(artist.id);
        if (!seenOnThisTrack.has(artist.id)) {
          seenOnThisTrack.add(artist.id);
          const cur = artistTrackCounts.get(artist.id);
          if (cur) {
            cur.count += 1;
          } else {
            artistTrackCounts.set(artist.id, { name: artist.name, count: 1 });
          }
        }
      }
    }

    const topArtists = Array.from(artistTrackCounts.entries())
      .map(([, { name, count }]) => ({
        name,
        count,
        share: topTracksCount > 0 ? count / topTracksCount : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    let stage2Label: Stage2Label = null;
    const primaryArtist = topArtists[0];
    if (primaryArtist && topTracksCount > 0) {
      const primaryShare = primaryArtist.share;
      if (primaryShare >= 0.4) {
        stage2Label = 'ONE_ARTIST_OBSESSED';
      } else if (artistIds.size >= 40 && primaryShare <= 0.18) {
        stage2Label = 'NO_ARTIST_TIES';
      } else if (artistIds.size >= 25) {
        stage2Label = 'MIXED_ARTISTS';
      } else {
        stage2Label = 'ARTIST_FOCUSED';
      }
    }

    // Stage 3: Recent listening rhythm (from recently-played, local time)
    const rawCount = recent.length;
    const timezoneUsed = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

    const seenTrackIds = new Set<string>();
    const deduped: { played_at: string; track?: { id?: string } }[] = [];
    for (const item of recent) {
      const id = item.track?.id;
      if (id && !seenTrackIds.has(id)) {
        seenTrackIds.add(id);
        deduped.push(item);
      }
    }
    const dedupedCount = deduped.length;

    const getLocalHour = (iso: string): number => {
      const d = new Date(iso);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezoneUsed,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(d), 10);
    };
    const getLocalDateKey = (iso: string): string => {
      const d = new Date(iso);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezoneUsed,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(d);
    };

    let morningCount = 0;
    let afternoonCount = 0;
    let eveningCount = 0;
    let lateNightCount = 0;
    const hourCounts: Record<number, number> = {};
    const dateKeys = new Set<string>();
    let minTs = Infinity;
    let maxTs = -Infinity;

    for (const item of deduped) {
      const hour = getLocalHour(item.played_at);
      const dateKey = getLocalDateKey(item.played_at);
      const ts = new Date(item.played_at).getTime();

      dateKeys.add(dateKey);
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      if (ts < minTs) minTs = ts;
      if (ts > maxTs) maxTs = ts;

      if (hour >= 5 && hour <= 10) morningCount += 1;
      else if (hour >= 11 && hour <= 16) afternoonCount += 1;
      else if (hour >= 17 && hour <= 22) eveningCount += 1;
      else lateNightCount += 1;
    }

    const totalCount = dedupedCount;
    const morningRatio = totalCount > 0 ? morningCount / totalCount : 0;
    const afternoonRatio = totalCount > 0 ? afternoonCount / totalCount : 0;
    const eveningRatio = totalCount > 0 ? eveningCount / totalCount : 0;
    const lateNightRatio = totalCount > 0 ? lateNightCount / totalCount : 0;

    const activeHours = Object.keys(hourCounts).length;
    const distinctDates = dateKeys.size;
    const timeSpanHours =
      minTs < maxTs ? (maxTs - minTs) / (1000 * 60 * 60) : 0;

    let peakHour = 0;
    let peakHourCount = 0;
    for (const [h, count] of Object.entries(hourCounts)) {
      const c = Number(count);
      if (c > peakHourCount) {
        peakHourCount = c;
        peakHour = parseInt(h, 10);
      }
    }
    const peakHourShare = totalCount > 0 ? peakHourCount / totalCount : 0;

    const to12 = (hour: number) => (hour === 0 ? 12 : hour > 12 ? hour - 12 : hour);
    const endHour = (peakHour + 1) % 24;
    const peakWindow =
      endHour === 0
        ? `${to12(peakHour)}–12 AM`
        : `${to12(peakHour)}–${to12(endHour)} ${endHour < 12 ? 'AM' : 'PM'}`;

    let confidence: 'HIGH' | 'LOW' = 'LOW';
    if (dedupedCount >= 25 && distinctDates >= 2 && timeSpanHours >= 18) {
      confidence = 'HIGH';
    }

    let stage3Label:
      | 'MORNING_STARTER'
      | 'DAYTIME_DRIFTER'
      | 'EVENING_UNWINDER'
      | 'AFTER_HOURS'
      | 'ALL_DAY_FLOW'
      | 'LOCKED_IN' = 'LOCKED_IN';

    if (confidence === 'HIGH') {
      if (morningRatio >= 0.5) {
        stage3Label = 'MORNING_STARTER';
      } else if (afternoonRatio >= 0.45) {
        stage3Label = 'DAYTIME_DRIFTER';
      } else if (eveningRatio >= 0.45) {
        stage3Label = 'EVENING_UNWINDER';
      } else if (lateNightRatio >= 0.4) {
        stage3Label = 'AFTER_HOURS';
      } else {
        stage3Label = 'ALL_DAY_FLOW';
      }
    } else {
      stage3Label = 'LOCKED_IN';
    }

    const response = NextResponse.json({
      stage1: routine,
      stage2: {
        label: stage2Label,
        uniqueArtistCount: artistIds.size,
        topTracksCount,
        topArtists,
      },
      stage3: {
        label: stage3Label,
        confidence,
        distribution: {
          morning: morningRatio,
          afternoon: afternoonRatio,
          evening: eveningRatio,
          lateNight: lateNightRatio,
        },
        rhythm: {
          activeHours,
          distinctDates,
          peakHour,
          peakWindow,
          peakHourCount,
          peakHourShare,
          timeSpanHours,
        },
      },
      stage4: curation,
      raw: {
        recentPlayedAt: recent.map((item) => item.played_at),
      },
    });
    if (auth.refreshed) {
      setSpotifyAuthCookies(
        response,
        auth.refreshedTokens,
        auth.existingRefreshToken
      );
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
