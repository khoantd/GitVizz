import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: any;
    jwt_token?: any;
    expires_in?: number;
    user_id?: any;
    token_type?: any;
  }
  interface JWT {
    accessToken?: any;
    jwt_token?: any;
    expires_in?: number;
    user_id?: any;
    token_type?: any;
  }
}
