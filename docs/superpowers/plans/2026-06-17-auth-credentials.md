# Auth Credentials — Email/Password Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password authentication with Credentials provider and a registration API route.

**Architecture:** Three file changes following the existing NextAuth v5 split-config pattern. `auth.config.ts` declares the Credentials provider placeholder (edge-safe), `auth.ts` overrides providers with real bcrypt validation, and a new `POST /api/auth/register` route handles user creation. No migration needed — `password` field already exists in schema.

**Tech Stack:** NextAuth v5 (beta), bcryptjs v3.0.3, Prisma 7 + Neon PostgreSQL

---

### Task 1: Add Credentials placeholder to auth.config.ts

**Files:**
- Modify: `src/auth.config.ts`

- [ ] **Step 1: Add Credentials import and placeholder provider**

Replace `src/auth.config.ts` with:

```ts
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [GitHub, Credentials({ authorize: () => null })],
} satisfies NextAuthConfig;
```

- [ ] **Step 2: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/auth.config.ts
git commit -m "feat: add credentials provider placeholder to auth config"
```

---

### Task 2: Override Credentials provider with bcrypt validation in auth.ts

**Files:**
- Modify: `src/auth.ts`

- [ ] **Step 1: Replace auth.ts with full providers override**

Replace `src/auth.ts` with:

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    GitHub,
    Credentials({
      authorize: async (credentials) => {
        const { email, password } = credentials as {
          email: string;
          password: string;
        };

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;

        const valid = await compare(password, user.password);
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
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: Run type check, lint, and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass, no errors

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts
git commit -m "feat: override credentials provider with bcrypt validation"
```

---

### Task 3: Create registration API route

**Files:**
- Create: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Create the route directory**

Run: `mkdir -p src/app/api/auth/register`

- [ ] **Step 2: Write the route handler**

Create `src/app/api/auth/register/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, confirmPassword } = await request.json();

    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: new Date(),
      },
    });

    return NextResponse.json(
      {
        message: "Registration successful",
        user: { id: user.id, name: user.name, email: user.email },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Run type check, lint, and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass, `/api/auth/register` appears in build output

- [ ] **Step 4: Verify GitHub OAuth still listed in build**

Run: `npm run build 2>&1 | grep -E "register|nextauth"`
Expected: Both `/api/auth/register` and `/api/auth/[...nextauth]` appear

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat: add email/password registration API route"
```

---

### Task 4: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Full clean build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all green, no warnings

- [ ] **Step 2: Check git log**

Run: `git log --oneline -4`
Expected: 3 commits visible (config, auth, register)

- [ ] **Step 3: Confirm no untracked files**

Run: `git status --short`
Expected: only pre-existing changes (AGENTS.md, spec file)
