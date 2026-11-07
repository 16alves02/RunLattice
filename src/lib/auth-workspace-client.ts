"use client";

import { authClient } from "@/lib/auth-client";

export async function ensureActiveWorkspace(defaultName: string) {
  const listed = await authClient.organization.list();
  if (listed.error) throw new Error(listed.error.message || "Could not load your workspaces.");

  let organizationId = listed.data?.[0]?.id;
  if (!organizationId) {
    const slugBase = defaultName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
    const created = await authClient.organization.create({
      name: defaultName,
      slug: `${slugBase}-${crypto.randomUUID().slice(0, 8)}`,
    });
    if (created.error || !created.data) {
      throw new Error(created.error?.message || "Could not create your workspace.");
    }
    organizationId = created.data.id;
  }

  const active = await authClient.organization.setActive({ organizationId });
  if (active.error) throw new Error(active.error.message || "Could not select your workspace.");
}
