-- Add organization-backed workspaces while preserving existing account ownership.
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logo" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE "Member" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Member_organizationId_userId_key" ON "Member"("organizationId", "userId");
CREATE INDEX "Member_userId_idx" ON "Member"("userId");

CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "role" TEXT,
  "status" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

ALTER TABLE "Session" ADD COLUMN "activeOrganizationId" TEXT;
ALTER TABLE "Workflow" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "Workflow_organizationId_updatedAt_idx" ON "Workflow"("organizationId", "updatedAt");

ALTER TABLE "Member" ADD CONSTRAINT "Member_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Give every existing account a personal workspace and owner membership.
INSERT INTO "Organization" ("id", "name", "slug", "createdAt")
SELECT
  'legacy-org-' || "id",
  COALESCE(NULLIF("name", ''), 'Personal workspace'),
  'personal-' || regexp_replace(lower("id"), '[^a-z0-9-]', '', 'g') || '-' || substr(md5("id"), 1, 8),
  CURRENT_TIMESTAMP
FROM "User";

INSERT INTO "Member" ("id", "organizationId", "userId", "role", "createdAt")
SELECT
  'legacy-member-' || substr(md5("id"), 1, 20),
  'legacy-org-' || "id",
  "id",
  'owner',
  CURRENT_TIMESTAMP
FROM "User";

-- Preserve each workflow's previous owner and attach it to that owner's new workspace.
UPDATE "Workflow"
SET "organizationId" = 'legacy-org-' || "userId"
WHERE "userId" IS NOT NULL;

-- Persist a default active workspace for existing sessions.
UPDATE "Session"
SET "activeOrganizationId" = 'legacy-org-' || "userId"
WHERE EXISTS (
  SELECT 1 FROM "Organization"
  WHERE "Organization"."id" = 'legacy-org-' || "Session"."userId"
);
