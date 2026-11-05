"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function selectWorkspace(organizationId: string) {
    setBusy(true);
    const result = await authClient.organization.setActive({ organizationId });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Could not switch workspace.");
      return;
    }
    setError("");
    router.refresh();
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Workspace name must contain at least two characters.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const slugBase = trimmedName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
      const result = await authClient.organization.create({
        name: trimmedName,
        slug: `${slugBase}-${crypto.randomUUID().slice(0, 8)}`,
      });
      if (result.error || !result.data) throw new Error(result.error?.message || "Could not create workspace.");

      const active = await authClient.organization.setActive({ organizationId: result.data.id });
      if (active.error) throw new Error(active.error.message || "Workspace was created but could not be selected.");

      setName("");
      setCreating(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-switcher">
      <label className="workspace-switcher-label" htmlFor="active-workspace">Workspace</label>
      <select
        id="active-workspace"
        className="field-input workspace-select"
        value={activeOrganization?.id ?? ""}
        disabled={busy || !organizations?.length}
        onChange={(event) => void selectWorkspace(event.target.value)}
      >
        {organizations?.map((organization) => (
          <option key={organization.id} value={organization.id}>{organization.name}</option>
        ))}
      </select>
      {!creating ? (
        <button className="workspace-create" type="button" onClick={() => setCreating(true)}>
          <Plus size={13} /> New workspace
        </button>
      ) : (
        <form className="workspace-create-form" onSubmit={(event) => void createWorkspace(event)}>
          <input className="field-input" aria-label="New workspace name" placeholder="Workspace name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus />
          <div className="workspace-create-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}><Check size={12} /> Create</button>
            <button className="btn" type="button" onClick={() => { setCreating(false); setError(""); }} disabled={busy} aria-label="Cancel"><X size={12} /></button>
          </div>
        </form>
      )}
      {error && <p className="workspace-error" role="alert">{error}</p>}
    </div>
  );
}
