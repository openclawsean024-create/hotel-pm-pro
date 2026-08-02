// auth.ts — Auth.js v5 config (用 pg 取代 prisma user 查詢)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pgQueryOne } from "@/lib/pg-client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Note: PrismaAdapter 移除 — 改用 JWT session + 直接 pg 查詢
  // (避免 Prisma prepared statement 與 Supabase pooler 衝突)
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await pgQueryOne<{
          id: string;
          email: string;
          name: string | null;
          image: string | null;
          passwordHash: string | null;
        }>(
          `SELECT id, email, name, image, "passwordHash" FROM "User" WHERE email = $1 LIMIT 1`,
          [email]
        );
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
