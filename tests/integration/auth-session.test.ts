import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { auth } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";

describe("Better Auth registration and session lifecycle", () => {
  const email = `auth-${randomUUID()}@example.test`;
  const password = "RunLattice-Test-Password-2026!";
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
      userId = undefined;
    }
  });

  it("creates an account, signs in, reads the session and signs out", async () => {
    const signup = await auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Integration Test", email, password }),
    }));
    expect(signup.status).toBe(200);
    const signupBody = await signup.json() as { user?: { id?: string; email?: string } };
    expect(signupBody.user?.email).toBe(email);
    userId = signupBody.user?.id;
    expect(userId).toBeTruthy();

    const signin = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }));
    expect(signin.status).toBe(200);
    const setCookie = signin.headers.get("set-cookie") ?? "";
    const sessionCookie = setCookie.match(/(?:__Secure-)?better-auth\.session_token=[^;]+/)?.[0];
    expect(sessionCookie).toBeTruthy();

    const session = await auth.handler(new Request("http://localhost:3000/api/auth/get-session", {
      headers: { cookie: sessionCookie! },
    }));
    expect(session.status).toBe(200);
    const sessionBody = await session.json() as { user?: { email?: string }; session?: { id?: string } };
    expect(sessionBody.user?.email).toBe(email);
    expect(sessionBody.session?.id).toBeTruthy();

    const signout = await auth.handler(new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: { cookie: sessionCookie! },
    }));
    expect(signout.status).toBe(200);

    const afterSignout = await auth.handler(new Request("http://localhost:3000/api/auth/get-session", {
      headers: { cookie: sessionCookie! },
    }));
    expect(await afterSignout.json()).toBeNull();
  });
});
