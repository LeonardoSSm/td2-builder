import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api/http";
import type { Profile, User, UserForm } from "../types";

export default function UsersCard({ tx }: { tx: (pt: string, en: string) => string }) {
  const qc = useQueryClient();

  const profiles = useQuery({
    queryKey: ["admin-access-profiles"],
    queryFn: () => apiGet<Profile[]>("/admin/access/profiles"),
  });

  const users = useQuery({
    queryKey: ["admin-access-users"],
    queryFn: () => apiGet<User[]>("/admin/access/users"),
  });

  const defaultProfileId = useMemo(() => profiles.data?.[0]?.id ?? "admin", [profiles.data]);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserForm>({
    name: "",
    email: "",
    profileId: "admin",
    active: true,
  });
  const [userPassword, setUserPassword] = useState("");

  const saveUser = useMutation({
    mutationFn: (payload: UserForm) =>
      editingUserId?.trim()
        ? apiPut<User>(`/admin/access/users/${editingUserId.trim()}`, payload)
        : apiPost<User>("/admin/access/users", payload),
    onSuccess: async (saved) => {
      if (saved?.id && typeof saved.id === "string") setEditingUserId(saved.id);
      await qc.invalidateQueries({ queryKey: ["admin-access-users"] });

      const p = userPassword.trim();
      if (p && saved?.id) {
        try {
          await apiPost(`/auth/users/${saved.id}/password`, { password: p });
          setUserPassword("");
        } catch {
          // Keep the user saved even if password change fails; user can retry.
        }
      }
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/access/users/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-access-users"] });
    },
  });

  return (
    <div className="td2-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{tx("Usuários", "Users")}</div>
        <button
          className="td2-btn text-[11px] px-2 py-1"
          onClick={() => {
            setEditingUserId(null);
            setUserForm({ name: "", email: "", profileId: defaultProfileId, active: true });
            setUserPassword("");
          }}
        >
          {tx("Novo", "New")}
        </button>
      </div>

      {users.isError ? <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(users.error as any)?.message}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input value={userForm.name} onChange={(e) => setUserForm((c) => ({ ...c, name: e.target.value }))} placeholder={tx("Nome", "Name")} className="td2-input px-3 py-2 text-sm" />
        <input value={userForm.email ?? ""} onChange={(e) => setUserForm((c) => ({ ...c, email: e.target.value }))} placeholder="email" className="td2-input px-3 py-2 text-sm" />
        <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder={tx("Senha (opcional)", "Password (optional)")} className="td2-input px-3 py-2 text-sm" />

        <select value={userForm.profileId} onChange={(e) => setUserForm((c) => ({ ...c, profileId: e.target.value }))} className="td2-select px-3 py-2 text-sm">
          {(profiles.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm td2-muted px-2">
          <input type="checkbox" checked={userForm.active} onChange={(e) => setUserForm((c) => ({ ...c, active: e.target.checked }))} />
          {tx("Ativo", "Active")}
        </label>
      </div>

      <div className="flex gap-2">
        <button className="td2-btn text-xs px-3 py-2" onClick={() => saveUser.mutate(userForm)} disabled={saveUser.isPending}>
          {saveUser.isPending ? tx("Salvando...", "Saving...") : tx("Salvar usuário", "Save user")}
        </button>
      </div>

      <div className="space-y-2">
        {(users.data ?? []).map((u) => (
          <div key={u.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{u.name}</div>
              <div className="flex gap-2">
                <button
                  className="td2-btn text-[11px] px-2 py-1"
                  onClick={() => {
                    setEditingUserId(u.id);
                    setUserForm({ name: u.name, email: u.email ?? "", profileId: u.profileId, active: u.active });
                    setUserPassword("");
                  }}
                >
                  {tx("Editar", "Edit")}
                </button>
                <button className="td2-btn td2-btn-danger text-[11px] px-2 py-1" onClick={() => deleteUser.mutate(u.id)}>
                  {tx("Remover", "Remove")}
                </button>
              </div>
            </div>
            <div className="td2-muted mt-1">{u.email ?? "-"}</div>
            <div className="td2-muted mt-1">
              {tx("Perfil", "Profile")}: <span className="font-mono">{u.profileId}</span> · {tx("Ativo", "Active")}: {String(u.active)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
