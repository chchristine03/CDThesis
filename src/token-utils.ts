import axios from 'axios';
import querystring from 'querystring';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * Utility functions for managing Spotify OAuth tokens
 * Based on Spotify's Authorization Code Flow and refresh token guides
 */
export class TokenUtils {
  /**
   * Refresh an access token using a refresh token
   * Follows Spotify's refresh token guide: https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
   */
  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<{ access_token: string; expires_in: number; token_type: string; scope?: string }> {
    try {
      const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        method: 'POST' as const,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        },
        data: querystring.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      };

      const response = await axios(authOptions);

      return {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorDescription = error.response?.data?.error_description;
        const errorMessage = error.response?.data?.error || error.message;
        throw new Error(
          `Failed to refresh token: ${errorDescription || errorMessage}`
        );
      }
      throw error;
    }
  }

  /**
   * Refresh token and update .env file
   * Convenience method that reads from environment and saves back to .env
   */
  static async refreshAndSaveToken(): Promise<string> {
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!refreshToken) {
      throw new Error('SPOTIFY_REFRESH_TOKEN not found in environment variables');
    }

    if (!clientId || !clientSecret) {
      throw new Error(
        'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required for token refresh'
      );
    }

    const { access_token, expires_in } = await this.refreshAccessToken(
      refreshToken,
      clientId,
      clientSecret
    );

    // Update .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    if (envContent.includes('SPOTIFY_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /SPOTIFY_ACCESS_TOKEN=.*/,
        `SPOTIFY_ACCESS_TOKEN=${access_token}`
      );
    } else {
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `SPOTIFY_ACCESS_TOKEN=${access_token}\n`;
    }

    fs.writeFileSync(envPath, envContent);

    console.log(`✅ Token refreshed! Expires in ${Math.floor(expires_in / 3600)} hours.`);
    return access_token;
  }
}

// CLI usage
if (require.main === module) {
  TokenUtils.refreshAndSaveToken()
    .then((token) => {
      console.log('✅ Token refreshed successfully!');
      console.log(`New token: ${token.substring(0, 20)}...`);
      console.log('Token saved to .env file');
    })
    .catch((error) => {
      console.error('❌ Failed to refresh token:', error.message);
      process.exit(1);
    });
}

