import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { organization, twoFactor } from "better-auth/plugins";
import { sendTransactionalEmail } from "@/lib/email";
import { PLAN_LIMITS, resolveEntitledPlan } from "@/lib/billing-core";

const secret = process.env.BETTER_AUTH_SECRET;
const production = process.env.NODE_ENV === "production";
const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

// Never allow production authentication to fall back to a public development secret
// or a localhost-only origin configuration.
const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

if (production && (!secret || secret.length < 32)) {
  throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters in production.");
}
if (production && !process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL must be configured in production.");
}
if (production && trustedOrigins.length === 0) {
  throw new Error("BETTER_AUTH_TRUSTED_ORIGINS must contain at least one trusted origin in production.");
}

export const auth = betterAuth({
  appName: "RunLattice",
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
      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your RunLattice password",
        text: `Use this secure link to reset your password: ${url}\n\nIf you did not request this, ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: emailConfigured,
    sendOnSignIn: emailConfigured,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Verify your RunLattice email",
        text: `Verify your email address to activate your RunLattice account: ${url}\n\nThis link expires in 24 hours.`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60,
    cookieCache: { enabled: false },
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
  plugins: [twoFactor({ issuer: "RunLattice", backupCodeOptions: { storeBackupCodes: "encrypted" }, accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 1800 } }), organization({
    requireEmailVerificationOnInvitation: true,
    invitationExpiresIn: 60 * 60 * 24 * 7,
    membershipLimit: async (_user, organizationRecord) => {
      const subscription = await prisma.billingSubscription.findUnique({
        where: { organizationId: organizationRecord.id },
        select: { plan: true, status: true, currentPeriodEnd: true },
      });
      const plan = resolveEntitledPlan(subscription);
      return PLAN_LIMITS[plan].members;
    },
  })],
  // Railway's public HTTP edge overwrites X-Real-IP with the connecting client IP.
  // Do not use X-Forwarded-For here: Railway may add proxy hops to that header.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-real-ip"],
    },
  },
  trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : ["http://localhost:3000"],
});
