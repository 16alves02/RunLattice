import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { organization } from "better-auth/plugins";
import { sendTransactionalEmail } from "@/lib/email";

const secret = process.env.BETTER_AUTH_SECRET;
const production = process.env.NODE_ENV === "production";
const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export const auth = betterAuth({
  secret: secret || "runlattice-local-development-secret-change-before-deploy",
  ...(process.env.BETTER_AUTH_URL ? { baseURL: process.env.BETTER_AUTH_URL } : {}),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: production && !emailConfigured,
    requireEmailVerification: production || emailConfigured,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: !production,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void sendTransactionalEmail({
        to: user.email,
        subject: "Reset your RunLattice password",
        text: `Use this secure link to reset your password: ${url}\n\nIf you did not request this, ignore this email.`,
      }).catch((error: unknown) => {
        console.error("[auth] Password reset email could not be sent:", error instanceof Error ? error.message : "Unknown error");
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      void sendTransactionalEmail({
        to: user.email,
        subject: "Verify your RunLattice email",
        text: `Verify your email address to activate your RunLattice account: ${url}\n\nThis link expires in 24 hours.`,
      }).catch((error: unknown) => {
        console.error("[auth] Verification email could not be sent:", error instanceof Error ? error.message : "Unknown error");
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  plugins: [organization({ requireEmailVerificationOnInvitation: true, invitationExpiresIn: 60 * 60 * 24 * 7 })],
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : ["http://localhost:3000"],
});
