import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { getJwtToken, refreshJwtToken } from './api';

// Get the correct backend URL for server-side requests
const getBackendUrl = () => {
  // For server-side requests in Docker, use internal container networking
  if (process.env.NODE_ENV === 'production') {
    return 'http://backend:8003';
  }
  // Development server-side requests
  return 'http://localhost:8003';
};

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: 'read:user user:email' } },
    }),
  ],
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // 24 hours
    // maxAge: 60, // 1 minute
    // updateAge: 60, // 1 minute
  },
  callbacks: {
    jwt: async ({ token, account }) => {
      // Initial sign in
      if (account) {
        token.accessToken = account.access_token;

        // Get JWT token and refresh token from backend
        if (typeof token.accessToken === 'string') {
          try {
            let data = await getJwtToken(token.accessToken);

            token.jwt_token = 'Bearer ' + data.jwt_token;
            token.exp = data.expires_in;
            token.user_id = data.user_id;
            token.token_type = data.token_type;
            token.refresh_token = data.refresh_token;
            token.refresh_expires_in = data.refresh_expires_in;
          } catch (error) {
            console.error('Failed to get JWT token during login:', error);
            return null; // This will force re-authentication
          }
        }
      }

      // Return previous token if the access token has not expired yet
      const currentTime = Math.floor(Date.now() / 1000);
      if (token.exp && currentTime < token.exp - 300) {
        // Refresh 5 minutes before expiry
        return token;
      }

      // Access token has expired, try to update it using refresh token
      if (token.refresh_token) {
        try {
          const refreshedTokens = await refreshJwtToken(token.refresh_token as string);

          return {
            ...token,
            jwt_token: 'Bearer ' + refreshedTokens.access_token,
            exp: refreshedTokens.expires_in,
          };
        } catch (error) {
          console.error('Failed to refresh token:', error);
          // Refresh token is invalid or expired, force re-authentication
          return null;
        }
      }

      // No refresh token available, force re-authentication
      return null;
    },
    session: async ({ session, token }) => {
      if (!token) {
        return session;
      }

      session.accessToken = token.accessToken;
      session.jwt_token = token.jwt_token;
      session.expires_in = token.exp;
      session.user_id = token.user_id;
      session.token_type = token.token_type;
      session.refresh_token = token.refresh_token;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
