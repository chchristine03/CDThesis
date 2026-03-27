import express from 'express';
import axios from 'axios';
import querystring from 'querystring';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { SpotifyClient } from './spotify-client';

dotenv.config();

const app = express();
const PORT = 8888;

// Spotify OAuth configuration
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
// Redirect URI must exactly match what's configured in your Spotify app settings
// You can override this with SPOTIFY_REDIRECT_URI environment variable
const REDIRECT_URI = `http://127.0.0.1:8888/callback`;

// Required scopes for the application
// These scopes are needed for:
// - user-top-read: Get user's top artists and tracks
// - playlist-read-private: Read user's private playlists
// - user-library-read: Read user's saved tracks
const SCOPE = 'user-top-read playlist-read-private user-library-read user-read-recently-played';

const ENV_PATH = path.join(process.cwd(), '.env');

type SummaryItem = {
  id: string;
  name: string;
  popularity?: number;
  count?: number;
};

/**
 * Generate a random string for state parameter (CSRF protection)
 * Based on Spotify's Authorization Code Flow tutorial
 */
function generateRandomString(length: number): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Store state to verify callback (in-memory, cleared on restart)
// In production, use a more persistent store (Redis, database, etc.)
const stateStore = new Map<string, number>();
const redirectStore = new Map<string, string>();

// Clean up old states (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [state, timestamp] of stateStore.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      stateStore.delete(state);
      redirectStore.delete(state);
    }
  }
}, 5 * 60 * 1000);

/**
 * Helper function to update .env file with tokens
 */
function updateEnvFile(tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}): void {
  let envContent = '';

  // Read existing .env file if it exists
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  }

  // Update or add SPOTIFY_ACCESS_TOKEN
  if (envContent.includes('SPOTIFY_ACCESS_TOKEN=')) {
    envContent = envContent.replace(
      /SPOTIFY_ACCESS_TOKEN=.*/,
      `SPOTIFY_ACCESS_TOKEN=${tokens.access_token}`
    );
  } else {
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `SPOTIFY_ACCESS_TOKEN=${tokens.access_token}\n`;
  }

  // Update or add SPOTIFY_REFRESH_TOKEN if present
  if (tokens.refresh_token) {
    if (envContent.includes('SPOTIFY_REFRESH_TOKEN=')) {
      envContent = envContent.replace(
        /SPOTIFY_REFRESH_TOKEN=.*/,
        `SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`
      );
    } else {
      envContent += `SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    }
  }

  // Write updated .env file
  fs.writeFileSync(ENV_PATH, envContent);

  // Keep in-memory env in sync for the running server
  process.env.SPOTIFY_ACCESS_TOKEN = tokens.access_token;
  if (tokens.refresh_token) {
    process.env.SPOTIFY_REFRESH_TOKEN = tokens.refresh_token;
  }
}

function loadEnvValue(key: string): string | undefined {
  const existing = process.env[key];
  if (existing) {
    return existing;
  }

  if (!fs.existsSync(ENV_PATH)) {
    return undefined;
  }

  const parsed = dotenv.parse(fs.readFileSync(ENV_PATH, 'utf8'));
  const value = parsed[key];
  if (value) {
    process.env[key] = value;
  }
  return value;
}

function renderLandingPage(): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Listening Home — Spotify Listening Insights</title>
        <style>
          @font-face {
            font-family: 'Switzer-Variable';
            src: url('/fonts/switzer/Switzer-Variable.woff2') format('woff2'),
                 url('/fonts/switzer/Switzer-Variable.woff') format('woff');
            font-weight: 100 900;
            font-display: swap;
            font-style: normal;
          }
          :root {
            color-scheme: light;
            --bg: #07070b;
            --panel: #14141d;
            --panel-strong: #1b1b28;
            --muted: #9aa0a6;
            --text: #f6f6f7;
            --accent: #1db954;
            --accent-2: #1ed760;
            --border: rgba(255, 255, 255, 0.08);
            --glow: rgba(29, 185, 84, 0.25);
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: 'Switzer-Variable', system-ui, -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
          }
          a { color: inherit; }
          header {
            padding: 56px 24px 20px;
            max-width: 980px;
            margin: 0 auto;
            text-align: center;
          }
          header h1 {
            margin: 0 0 12px;
            font-size: 40px;
            letter-spacing: -0.02em;
          }
          header p {
            margin: 0 auto;
            color: var(--muted);
            font-size: 16px;
            max-width: 560px;
          }
          main {
            max-width: 980px;
            margin: 0 auto;
            padding: 0 24px 40px;
            display: grid;
            gap: 20px;
          }
          .panel {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
          }
          .row {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
            justify-content: space-between;
          }
          .button {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 10px 18px;
            border-radius: 999px;
            background: var(--accent);
            color: #031f0e;
            text-decoration: none;
            font-weight: 600;
            border: none;
            cursor: pointer;
            box-shadow: 0 12px 30px rgba(29, 185, 84, 0.25);
          }
          .button.secondary {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text);
            box-shadow: none;
          }
          .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .status {
            color: var(--muted);
            font-size: 14px;
          }
          .grid {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          }
          .chart {
            display: grid;
            gap: 8px;
          }
          .chart-row {
            display: grid;
            gap: 6px;
          }
          .chart-label {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: var(--muted);
          }
          .bar {
            height: 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.1);
            overflow: hidden;
          }
          .bar > span {
            display: block;
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, var(--accent), var(--accent-2));
          }
          .list {
            margin: 0;
            padding: 0;
            list-style: none;
            display: grid;
            gap: 8px;
          }
          .list li {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
          }
          .profile {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border);
            display: grid;
            place-items: center;
            color: var(--muted);
            font-weight: 600;
            font-size: 16px;
            overflow: hidden;
          }
          .avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            background: rgba(29, 185, 84, 0.12);
            color: var(--accent-2);
            border: 1px solid rgba(29, 185, 84, 0.25);
          }
          .muted {
            color: var(--muted);
          }
          footer {
            max-width: 980px;
            margin: 0 auto;
            padding: 8px 24px 32px;
            color: var(--muted);
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>Pulse</h1>
          <p>Connect Spotify to see your top artists, tracks, and genres.</p>
        </header>
        <main>
          <section class="panel">
            <div class="row">
              <div class="profile">
                <div class="avatar" id="profile-avatar">♪</div>
                <div>
                  <div class="pill" id="profile-pill">Not connected</div>
                  <h2 id="welcome-title">Welcome</h2>
                  <p class="status" id="status-text">Checking Spotify connection...</p>
                </div>
              </div>
              <div class="row">
                <a class="button" id="login-btn" href="/login">Connect Spotify</a>
                <button class="button secondary" id="run-btn">Run analysis</button>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="row">
              <h3>Listening snapshot</h3>
              <span class="status" id="last-updated">Not run yet</span>
            </div>
            <div class="grid">
              <div>
                <h4>Top Artists</h4>
                <div class="chart" id="top-artists"></div>
              </div>
              <div>
                <h4>Top Tracks</h4>
                <div class="chart" id="top-tracks"></div>
              </div>
              <div>
                <h4>Top Genres</h4>
                <ul class="list" id="top-genres"></ul>
              </div>
            </div>
          </section>
        </main>
        <footer>Powered by your local Spotify Web API client.</footer>

        <script>
          const statusText = document.getElementById('status-text');
          const welcomeTitle = document.getElementById('welcome-title');
          const loginBtn = document.getElementById('login-btn');
          const runBtn = document.getElementById('run-btn');
          const lastUpdated = document.getElementById('last-updated');
          const topArtists = document.getElementById('top-artists');
          const topTracks = document.getElementById('top-tracks');
          const topGenres = document.getElementById('top-genres');
          const profileAvatar = document.getElementById('profile-avatar');
          const profilePill = document.getElementById('profile-pill');

          function renderBars(target, items, valueKey) {
            target.innerHTML = '';
            if (!items || items.length === 0) {
              target.innerHTML = '<p class="muted">No data yet.</p>';
              return;
            }
            const maxValue = Math.max(...items.map(item => item[valueKey] || 0), 1);
            items.forEach((item, index) => {
              const row = document.createElement('div');
              row.className = 'chart-row';
              const label = document.createElement('div');
              label.className = 'chart-label';
              label.innerHTML = '<span>' + (index + 1) + '. ' + item.name + '</span>' +
                '<span>' + (item[valueKey] ?? 0) + '</span>';
              const bar = document.createElement('div');
              bar.className = 'bar';
              const fill = document.createElement('span');
              fill.style.width = ((item[valueKey] || 0) / maxValue * 100).toFixed(2) + '%';
              bar.appendChild(fill);
              row.appendChild(label);
              row.appendChild(bar);
              target.appendChild(row);
            });
          }

          function renderGenreList(items) {
            topGenres.innerHTML = '';
            if (!items || items.length === 0) {
              topGenres.innerHTML = '<li class="muted">No data yet.</li>';
              return;
            }
            items.forEach((item, index) => {
              const li = document.createElement('li');
              li.innerHTML = '<span>' + (index + 1) + '. ' + item.name + '</span>' +
                '<span>' + item.count + '</span>';
              topGenres.appendChild(li);
            });
          }

          async function loadStatus() {
            try {
              const response = await fetch('/api/status');
              const data = await response.json();
              if (!data.hasClientConfig) {
                statusText.textContent = 'Missing Spotify client credentials. Add them to .env.';
                loginBtn.setAttribute('disabled', 'true');
                runBtn.setAttribute('disabled', 'true');
                return;
              }
              if (!data.hasAccessToken) {
                statusText.textContent = 'Not authorized yet. Click "Authorize Spotify" to continue.';
                profilePill.textContent = 'Not connected';
                return;
              }
              statusText.textContent = 'Authorized. Ready to run analysis.';
              profilePill.textContent = 'Connected';
            } catch (error) {
              statusText.textContent = 'Unable to reach the API server.';
            }
          }

          async function runAnalysis() {
            runBtn.setAttribute('disabled', 'true');
            statusText.textContent = 'Running analysis...';
            try {
              const response = await fetch('/api/summary');
              const data = await response.json();
              if (!response.ok) {
                statusText.textContent = data.error || 'Unable to load analysis.';
                return;
              }
              if (data.profile?.displayName) {
                welcomeTitle.textContent = 'Welcome, ' + data.profile.displayName;
              }
              if (data.profile?.imageUrl) {
                profileAvatar.innerHTML = '<img src="' + data.profile.imageUrl + '" alt="Profile" />';
              } else if (data.profile?.displayName) {
                profileAvatar.textContent = data.profile.displayName.charAt(0).toUpperCase();
              }
              if (data.profile?.displayName) {
                profilePill.textContent = 'Connected';
              }
              renderBars(topArtists, data.topArtists, 'popularity');
              renderBars(topTracks, data.topTracks, 'popularity');
              renderGenreList(data.topGenres);
              statusText.textContent = 'Analysis complete.';
              const timestamp = new Date().toLocaleString();
              lastUpdated.textContent = 'Updated ' + timestamp;
            } catch (error) {
              statusText.textContent = 'Analysis failed. Please try again.';
            } finally {
              runBtn.removeAttribute('disabled');
            }
          }

          runBtn.addEventListener('click', runAnalysis);
          loadStatus();
        </script>
      </body>
    </html>
  `;
}

/**
 * Root endpoint - provides instructions
 */
app.get('/', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.send(`
      <html>
        <head><title>Spotify OAuth Setup</title></head>
        <body>
          <h1>❌ Missing Configuration</h1>
          <p>Please set the following environment variables in your <code>.env</code> file:</p>
          <ul>
            <li><code>SPOTIFY_CLIENT_ID</code> - Your Spotify app Client ID</li>
            <li><code>SPOTIFY_CLIENT_SECRET</code> - Your Spotify app Client Secret</li>
          </ul>
          <p><strong>Important:</strong> Make sure to add this exact redirect URI to your Spotify app:</p>
          <p><code>${REDIRECT_URI}</code></p>
          <p>Get your credentials from: <a href="https://developer.spotify.com/dashboard" target="_blank">Spotify Developer Dashboard</a></p>
          <p>See the <a href="https://developer.spotify.com/documentation/web-api/tutorials/code-flow" target="_blank">Authorization Code Flow tutorial</a> for details.</p>
        </body>
      </html>
    `);
    return;
  }
  res.send(renderLandingPage());
});

app.get('/api/status', (req, res) => {
  const accessToken = loadEnvValue('SPOTIFY_ACCESS_TOKEN');
  res.json({
    hasClientConfig: Boolean(CLIENT_ID && CLIENT_SECRET),
    hasAccessToken: Boolean(accessToken),
  });
});

app.get('/api/summary', async (req, res) => {
  const accessToken = loadEnvValue('SPOTIFY_ACCESS_TOKEN');
  if (!accessToken) {
    res.status(401).json({ error: 'Missing access token. Authorize Spotify first.' });
    return;
  }

  try {
    const client = new SpotifyClient(accessToken);
    const [profile, artists, tracks] = await Promise.all([
      client.getCurrentUserProfile(),
      client.getTopArtists('medium_term', 10, 0),
      client.getTopTracks('medium_term', 10, 0),
    ]);

    const genreCounts = new Map<string, number>();
    for (const artist of artists.items) {
      for (const genre of artist.genres ?? []) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }

    const topGenres: SummaryItem[] = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ id: name, name, count }));

    res.json({
      profile: {
        displayName: profile.display_name,
        id: profile.id,
        imageUrl: profile.images?.[0]?.url ?? null,
      },
      topArtists: artists.items.map((artist) => ({
        id: artist.id,
        name: artist.name,
        popularity: artist.popularity,
      })),
      topTracks: tracks.items.map((track) => ({
        id: track.id,
        name: track.name,
        popularity: track.popularity,
      })),
      topGenres,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Login endpoint - redirects to Spotify authorization
 * Based on Spotify's Authorization Code Flow tutorial
 */
app.get('/login', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).send('Missing CLIENT_ID or CLIENT_SECRET in environment variables');
    return;
  }

  // Generate a random state string for CSRF protection
  const state = generateRandomString(16);
  stateStore.set(state, Date.now());
  const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : null;
  if (redirect) {
    redirectStore.set(state, redirect);
  }

  // Build authorization URL following Spotify's Authorization Code Flow
  const authUrl =
    'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: SCOPE,
      redirect_uri: REDIRECT_URI,
      state: state,
      show_dialog: true, // Force user to approve even if previously approved
    });

  res.redirect(authUrl);
});

/**
 * Callback endpoint - handles authorization code and exchanges for token
 * Based on Spotify's Authorization Code Flow tutorial
 */
app.get('/callback', async (req, res) => {
  const code = req.query.code as string | null;
  const state = req.query.state as string | null;
  const error = req.query.error as string | null;

  // Handle errors from Spotify
  if (error) {
    res.send(`
      <html>
        <head><title>Authorization Error</title></head>
        <body>
          <h1>❌ Authorization Failed</h1>
          <p>Error: ${error}</p>
          <p><a href="/">Try again</a></p>
        </body>
      </html>
    `);
    return;
  }

  // Verify state parameter to prevent CSRF attacks
  // This follows Spotify's recommendation from the tutorial
  if (state === null || !stateStore.has(state)) {
    res.status(400).send(`
      <html>
        <head><title>Invalid State</title></head>
        <body>
          <h1>❌ Invalid State Parameter</h1>
          <p>The state parameter is invalid or expired. This may be a security issue.</p>
          <p><a href="/">Try again</a></p>
        </body>
      </html>
    `);
    return;
  }

  // Clean up used state (state can only be used once)
  stateStore.delete(state);
  const redirectUrl = state ? redirectStore.get(state) : null;
  if (state) {
    redirectStore.delete(state);
  }

  if (!code) {
    res.status(400).send(`
      <html>
        <head><title>Missing Code</title></head>
        <body>
          <h1>❌ Missing Authorization Code</h1>
          <p>No authorization code was provided.</p>
          <p><a href="/">Try again</a></p>
        </body>
      </html>
    `);
    return;
  }

  try {
    // Exchange authorization code for access token
    // Following Spotify's Authorization Code Flow tutorial exactly
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      method: 'POST' as const,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      },
      data: querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    };

    const tokenResponse = await axios(authOptions);

    const {
      access_token,
      refresh_token,
      expires_in,
      token_type,
      scope,
    } = tokenResponse.data;

    // Save tokens to .env file
    updateEnvFile({
      access_token,
      refresh_token,
      expires_in,
    });

    // Redirect to client after successful auth if provided
    if (redirectUrl) {
      res.redirect(redirectUrl);
      return;
    }

    res.redirect('/');
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    let errorMessage = 'Unknown error';
    let errorDescription = '';

    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.error || error.message;
      errorDescription = error.response.data?.error_description || '';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    res.status(500).send(`
      <html>
        <head><title>Token Exchange Error</title></head>
        <body>
          <h1>❌ Token Exchange Failed</h1>
          <p><strong>Error:</strong> ${errorMessage}</p>
          ${errorDescription ? `<p><strong>Description:</strong> ${errorDescription}</p>` : ''}
          <p><a href="/">Try again</a></p>
        </body>
      </html>
    `);
  }
});

/**
 * Refresh token endpoint - get a new access token using refresh token
 * Based on Spotify's refresh token guide
 */
app.get('/refresh', async (req, res) => {
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!refreshToken) {
    res.status(400).send(`
      <html>
        <head><title>No Refresh Token</title></head>
        <body>
          <h1>❌ No Refresh Token Found</h1>
          <p>Please authorize the app first: <a href="/login">Authorize</a></p>
        </body>
      </html>
    `);
    return;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).send('Missing CLIENT_ID or CLIENT_SECRET');
    return;
  }

  try {
    // Request new access token using refresh token
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      method: 'POST' as const,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      },
      data: querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    };

    const tokenResponse = await axios(authOptions);

    const { access_token, expires_in, token_type, scope } = tokenResponse.data;

    // Update .env file with new access token
    updateEnvFile({
      access_token,
      refresh_token: refreshToken, // Keep the same refresh token
      expires_in,
    });

    res.send(`
      <html>
        <head><title>Token Refreshed</title></head>
        <body>
          <h1>✅ Token Refreshed!</h1>
          <p>New access token saved to <code>.env</code> file.</p>
          <hr>
          <h2>Token Information:</h2>
          <ul>
            <li><strong>Token Type:</strong> ${token_type}</li>
            <li><strong>Access Token:</strong> ${access_token.substring(0, 20)}... (saved to .env)</li>
            <li><strong>Expires In:</strong> ${expires_in} seconds (${Math.floor(expires_in / 3600)} hours)</li>
            ${scope ? `<li><strong>Scopes:</strong> ${scope}</li>` : ''}
          </ul>
          <hr>
          <p><a href="/">Back to Home</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error refreshing token:', error);
    let errorMessage = 'Unknown error';
    let errorDescription = '';

    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.error || error.message;
      errorDescription = error.response.data?.error_description || '';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    res.status(500).send(`
      <html>
        <head><title>Refresh Error</title></head>
        <body>
          <h1>❌ Token Refresh Failed</h1>
          <p><strong>Error:</strong> ${errorMessage}</p>
          ${errorDescription ? `<p><strong>Description:</strong> ${errorDescription}</p>` : ''}
          <p>You may need to re-authorize: <a href="/login">Authorize</a></p>
        </body>
      </html>
    `);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Spotify OAuth server running on http://localhost:${PORT}`);
  console.log(`\n📋 Setup Instructions (following Spotify's Authorization Code Flow):`);
  console.log(`   1. Make sure you have SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file`);
  console.log(`\n⚠️  IMPORTANT - Add Redirect URI to Spotify App:`);
  console.log(`   Go to: https://developer.spotify.com/dashboard`);
  console.log(`   1. Open your app`);
  console.log(`   2. Click "Edit Settings"`);
  console.log(`   3. Under "Redirect URIs", click "Add"`);
  console.log(`   4. Add this EXACT URI (case-sensitive, must match exactly):`);
  console.log(`      ${REDIRECT_URI}`);
  console.log(`   5. Click "Add" and then "Save"\n`);
  console.log(`   6. Open http://localhost:${PORT} in your browser`);
  console.log(`   7. Click "Authorize Spotify" to get your access token\n`);
  console.log(`🔐 Requested Scopes:`);
  console.log(`   - user-top-read (top artists/tracks)`);
  console.log(`   - playlist-read-private (private playlists)`);
  console.log(`   - user-library-read (saved tracks)`);
  console.log(`   - user-read-recently-played (recently played)\n`);
  console.log(`📚 Documentation: https://developer.spotify.com/documentation/web-api/tutorials/code-flow\n`);
});
