import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * NextAuth.js v5 configuration.
 *
 * Uses the Credentials provider with email/password, JWT session strategy,
 * and custom callbacks to attach user ID and role to the session token.
 *
 * Exported objects:
 * - `handlers` — GET/POST route handlers for `/api/auth/[...nextauth]`
 * - `auth` — Server-side session getter
 * - `signIn` / `signOut` — Server-side sign-in/sign-out actions
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          // Constant-time: run dummy bcrypt compare to prevent timing oracle
          // that would reveal whether an email is registered (DM-M02)
          await compare(credentials.password as string, "$2a$12$000000000000000000000000000000000000000000000000000000");
          return null;
        }

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role ?? "viewer";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
