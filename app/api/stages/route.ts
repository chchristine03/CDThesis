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
    const [profile, recent, topShort, topMedium, topLong, routine, curation] = await Promise.all([
      client.getCurrentUserProfile(),
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
    let stage2MatchedRule = 'insufficient_data';
    if (primaryArtist && topTracksCount > 0) {
      const primaryShare = primaryArtist.share;
      if (primaryShare >= 0.4) {
        stage2Label = 'ONE_ARTIST_OBSESSED';
        stage2MatchedRule = 'primary_artist_share >= 0.40';
      } else if (artistIds.size >= 40 && primaryShare <= 0.18) {
        stage2Label = 'NO_ARTIST_TIES';
        stage2MatchedRule = 'unique_artists >= 40 and primary_artist_share <= 0.18';
      } else if (artistIds.size >= 25) {
        stage2Label = 'MIXED_ARTISTS';
        stage2MatchedRule = 'unique_artists >= 25';
      } else {
        stage2Label = 'ARTIST_FOCUSED';
        stage2MatchedRule = 'fallback: unique_artists < 25 and not dominated by one artist';
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
    let stage3MatchedRule = 'insufficient_confidence';

    if (confidence === 'HIGH') {
      if (morningRatio >= 0.5) {
        stage3Label = 'MORNING_STARTER';
        stage3MatchedRule = 'morning_ratio >= 0.50';
      } else if (afternoonRatio >= 0.45) {
        stage3Label = 'DAYTIME_DRIFTER';
        stage3MatchedRule = 'afternoon_ratio >= 0.45';
      } else if (eveningRatio >= 0.45) {
        stage3Label = 'EVENING_UNWINDER';
        stage3MatchedRule = 'evening_ratio >= 0.45';
      } else if (lateNightRatio >= 0.4) {
        stage3Label = 'AFTER_HOURS';
        stage3MatchedRule = 'late_night_ratio >= 0.40';
      } else {
        stage3Label = 'ALL_DAY_FLOW';
        stage3MatchedRule = 'high confidence with no dominant daypart';
      }
    } else {
      stage3Label = 'LOCKED_IN';
      stage3MatchedRule = 'confidence is LOW';
    }

    const stage1MatchedRule =
      routine.label === 'PATH_FOLLOWER'
        ? 'familiarity_score >= 0.55'
        : routine.label === 'IN_ROTATION'
          ? '0.30 <= familiarity_score < 0.55'
          : routine.label === 'EXPLORER'
            ? 'familiarity_score < 0.30'
            : 'insufficient_data_or_error';

    const stage4Stats = curation.stats;
    const stage4MatchedRule =
      curation.label === 'STREAMER'
        ? 'playlist_count < 3'
        : curation.label === 'WORLD_BUILDER'
          ? 'one_big_share >= 0.35 OR (large_count >= 2 and substantial_count <= 6)'
          : curation.label === 'POWER_CURATOR'
            ? 'playlist_count >= 35 and total_tracks >= 1500 and substantial_count >= 15'
            : curation.label === 'MICRO_CURATOR'
              ? 'micro_count >= 12 and micro_share >= 0.35 and substantial_ratio < 0.45'
              : curation.label === 'ARCHIVIST'
                ? 'playlist_count >= 12 and substantial_count >= 8'
                : curation.label === 'CASUAL_CURATOR'
                  ? 'fallback: does not match stronger curator categories'
                  : 'insufficient_data_or_error';

    const response = NextResponse.json({
      user: {
        username: profile.display_name ?? profile.id,
        email: profile.email ?? null,
      },
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
      explanation: {
        stage1: {
          persona: routine.label,
          matchedRule: stage1MatchedRule,
          calculation: {
            formula:
              'familiarity_score = intersection(short_term_top_tracks, medium_term_top_tracks) / short_term_top_tracks_count',
            inputs: routine.stats,
            output: {
              familiarity_score: routine.familiarity_score,
            },
          },
          categorizationRules: [
            'PATH_FOLLOWER if familiarity_score >= 0.55',
            'IN_ROTATION if familiarity_score >= 0.30 and < 0.55',
            'EXPLORER if familiarity_score < 0.30',
          ],
        },
        stage2: {
          persona: stage2Label,
          matchedRule: stage2MatchedRule,
          calculation: {
            formula:
              'Count unique artists across short-term top tracks and compute primary_artist_share = top_artist_track_count / top_tracks_count',
            inputs: {
              topTracksCount,
              uniqueArtistCount: artistIds.size,
              primaryArtist: primaryArtist
                ? {
                    name: primaryArtist.name,
                    count: primaryArtist.count,
                    share: primaryArtist.share,
                  }
                : null,
            },
          },
          categorizationRules: [
            'ONE_ARTIST_OBSESSED if primary_artist_share >= 0.40',
            'NO_ARTIST_TIES if unique_artist_count >= 40 and primary_artist_share <= 0.18',
            'MIXED_ARTISTS if unique_artist_count >= 25',
            'ARTIST_FOCUSED otherwise',
          ],
        },
        stage3: {
          persona: stage3Label,
          matchedRule: stage3MatchedRule,
          calculation: {
            method:
              'Use recently played tracks, dedupe by track id, bucket local hours into morning/afternoon/evening/late-night, then compute ratios.',
            confidenceRule:
              'HIGH if deduped_count >= 25 and distinct_dates >= 2 and time_span_hours >= 18; otherwise LOW',
            inputs: {
              rawCount,
              dedupedCount,
              distinctDates,
              timeSpanHours,
              morningCount,
              afternoonCount,
              eveningCount,
              lateNightCount,
            },
            outputs: {
              confidence,
              distribution: {
                morning: morningRatio,
                afternoon: afternoonRatio,
                evening: eveningRatio,
                lateNight: lateNightRatio,
              },
            },
          },
          categorizationRules: [
            'LOCKED_IN if confidence is LOW',
            'MORNING_STARTER if confidence HIGH and morning_ratio >= 0.50',
            'DAYTIME_DRIFTER if confidence HIGH and afternoon_ratio >= 0.45',
            'EVENING_UNWINDER if confidence HIGH and evening_ratio >= 0.45',
            'AFTER_HOURS if confidence HIGH and late_night_ratio >= 0.40',
            'ALL_DAY_FLOW otherwise when confidence HIGH',
          ],
        },
        stage4: {
          persona: curation.label,
          matchedRule: stage4MatchedRule,
          calculation: {
            method:
              'Analyze owned playlists with at least 1 track, compute size distribution and concentration metrics.',
            inputs: stage4Stats,
            derived: {
              microShare:
                stage4Stats.playlistCount > 0
                  ? stage4Stats.microCount / stage4Stats.playlistCount
                  : 0,
            },
          },
          categorizationRules: [
            'STREAMER if playlist_count < 3',
            'WORLD_BUILDER if one_big_share >= 0.35 OR (large_count >= 2 and substantial_count <= 6)',
            'POWER_CURATOR if playlist_count >= 35 and total_tracks >= 1500 and substantial_count >= 15',
            'MICRO_CURATOR if micro_count >= 12 and micro_share >= 0.35 and substantial_ratio < 0.45',
            'ARCHIVIST if playlist_count >= 12 and substantial_count >= 8',
            'CASUAL_CURATOR otherwise',
          ],
        },
      },
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
