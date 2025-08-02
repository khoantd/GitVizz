import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { getJwtToken } from './api';

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: 'read:user user:email' } },
    }),
  ],
  trustHost: true,
  callbacks: {
    jwt: async ({ token, account }) => {
      // console.log(account)
      if (account) {
        token.accessToken = account.access_token;

        // get jwt_token, expires_in, user_id, token_type from account
        if (typeof token.accessToken === 'string') {
          let data = await getJwtToken(token.accessToken);

          token.jwt_token = 'Bearer ' + data.jwt_token;
          token.exp = data.expires_in;
          token.user_id = data.user_id;
          token.token_type = data.token_type;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.accessToken = token.accessToken;
      session.jwt_token = token.jwt_token;
      session.expires_in = token.exp;
      session.user_id = token.user_id;
      session.token_type = token.token_type;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
