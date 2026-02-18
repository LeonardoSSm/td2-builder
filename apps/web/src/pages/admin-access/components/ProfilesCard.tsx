import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api/http";
import { PERMISSIONS, type PermissionKey } from "../permissions";
import type { Profile, ProfileForm } from "../types";

export default function ProfilesCard({ tx }: { tx: (pt: string, en: string) => string }) {
  const qc = useQueryClient();

  const profiles = useQuery({
    queryKey: ["admin-access-profiles"],
    queryFn: () => apiGet<Profile[]>("/admin/access/profiles"),
  });

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: "",
    permissions: ["admin.items.manage"],
  });

  const saveProfile = useMutation({
    mutationFn: (payload: ProfileForm) =>
      editingProfileId?.trim()
        ? apiPut<Profile>(`/admin/access/profiles/${editingProfileId.trim()}`, payload)
        : apiPost<Profile>("/admin/access/profiles", payload),
    onSuccess: async (saved) => {
      if (saved?.id && typeof saved.id === "string") setEditingProfileId(saved.id);
      await qc.invalidateQueries({ queryKey: ["admin-access-profiles"] });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/access/profiles/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-access-profiles"] });
      await qc.invalidateQueries({ queryKey: ["admin-access-users"] });
    },
  });

  const togglePerm = (p: PermissionKey) => {
    setProfileForm((cur) => {
      const has = cur.permissions.includes(p);
      const next = has ? cur.permissions.filter((x) => x !== p) : [...cur.permissions, p];
      return { ...cur, permissions: next };
    });
  };

  return (
    <div className="td2-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{tx("Perfis", "Profiles")}</div>
        <button
          className="td2-btn text-[11px] px-2 py-1"
          onClick={() => {
            setEditingProfileId(null);
            setProfileForm({ name: "", permissions: ["admin.items.manage"] });
          }}
        >
          {tx("Novo", "New")}
        </button>
      </div>

      {profiles.isError ? (
        <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(profiles.error as any)?.message}</div>
      ) : null}

      <input
        value={profileForm.name}
        onChange={(e) => setProfileForm((c) => ({ ...c, name: e.target.value }))}
        placeholder={tx("Nome", "Name")}
        className="td2-input px-3 py-2 text-sm"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {PERMISSIONS.map((p) => (
          <label key={p} className="flex items-center gap-2 text-xs td2-muted px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/30">
            <input type="checkbox" checked={profileForm.permissions.includes(p)} onChange={() => togglePerm(p)} />
            <span className="font-mono">{p}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="td2-btn text-xs px-3 py-2" onClick={() => saveProfile.mutate(profileForm)} disabled={saveProfile.isPending}>
          {saveProfile.isPending ? tx("Salvando...", "Saving...") : tx("Salvar perfil", "Save profile")}
        </button>
      </div>

      <div className="space-y-2">
        {(profiles.data ?? []).map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{p.name}</div>
              <div className="flex gap-2">
                <button
                  className="td2-btn text-[11px] px-2 py-1"
                  onClick={() => {
                    setEditingProfileId(p.id);
                    setProfileForm({ name: p.name, permissions: p.permissions });
                  }}
                >
                  {tx("Editar", "Edit")}
                </button>
                <button className="td2-btn td2-btn-danger text-[11px] px-2 py-1" onClick={() => deleteProfile.mutate(p.id)}>
                  {tx("Remover", "Remove")}
                </button>
              </div>
            </div>
            <div className="td2-muted mt-2 font-mono">{p.permissions.join(", ") || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
