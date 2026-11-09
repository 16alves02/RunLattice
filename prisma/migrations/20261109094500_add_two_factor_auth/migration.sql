ALTER TABLE "User"
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwoFactor_userId_key" ON "TwoFactor"("userId");

ALTER TABLE "TwoFactor"
ADD CONSTRAINT "TwoFactor_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
