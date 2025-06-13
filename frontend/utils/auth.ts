import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user user:email" } }
    })
  ],
  callbacks: {
    jwt: async ({ token, account }) => {
      console.log(account)
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    session: async ({ session, token }) => {
      session.accessToken = token.accessToken
      return session
    }
  },
  pages: {
    signIn: '/login'
  }
})