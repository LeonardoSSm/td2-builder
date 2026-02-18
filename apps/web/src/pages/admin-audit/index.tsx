import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/http";
import { useI18n } from "../../i18n";

type AuditItem = {
  id: string;
  at: string;
  userId: string | null;
  ip: string | null;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
};

type AuditListResponse = {
  items: AuditItem[];
  total: number;
  page: number;
  take: number;
  totalPages: number;
};

type AuditSummaryResponse = {
  days: number;
  total: number;
  success: number;
  failed: number;
  topPaths: Array<{ path: string; count: number }>;
};

export default function AdminAuditPage() {
  const { tx } = useI18n();
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");
  const [path, setPath] = useState("");
  const [ok, setOk] = useState<"" | "true" | "false">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const take = 25;

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("take", String(take));
    if (q.trim()) p.set("q", q.trim());
    if (userId.trim()) p.set("userId", userId.trim());
    if (path.trim()) p.set("path", path.trim());
    if (ok) p.set("ok", ok);
    if (from) p.set("from", new Date(from).toISOString());
    if (to) p.set("to", new Date(to).toISOString());
    return p.toString();
  }, [page, q, userId, path, ok, from, to]);

  const list = useQuery({
    queryKey: ["admin-audit-list", queryString],
    queryFn: () => apiGet<AuditListResponse>(`/admin/audit?${queryString}`),
  });

  const summary = useQuery({
    queryKey: ["admin-audit-summary"],
    queryFn: () => apiGet<AuditSummaryResponse>("/admin/audit/summary?days=1"),
  });

  const rows = list.data?.items ?? [];
  const totalPages = list.data?.totalPages ?? 1;

  return (
    <div className="td2-page space-y-4">
      <div>
        <div className="td2-heading text-lg font-semibold">{tx("Admin Auditoria", "Admin Audit")}</div>
        <div className="text-xs td2-subheading mt-1">{tx("Rastreamento de ações sensíveis (admin e IA).", "Sensitive actions tracking (admin and AI).")}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="td2-card rounded-xl p-3">
          <div className="text-xs td2-muted">{tx("Últimas 24h", "Last 24h")}</div>
          <div className="text-lg font-semibold mt-1">{summary.data?.total ?? "-"}</div>
        </div>
        <div className="td2-card rounded-xl p-3">
          <div className="text-xs td2-muted">{tx("Sucesso", "Success")}</div>
          <div className="text-lg font-semibold mt-1 text-emerald-300">{summary.data?.success ?? "-"}</div>
        </div>
        <div className="td2-card rounded-xl p-3">
          <div className="text-xs td2-muted">{tx("Falhas", "Failures")}</div>
          <div className="text-lg font-semibold mt-1 text-red-300">{summary.data?.failed ?? "-"}</div>
        </div>
        <div className="td2-card rounded-xl p-3">
          <div className="text-xs td2-muted">{tx("Top rota", "Top path")}</div>
          <div className="text-sm font-semibold mt-1 truncate">{summary.data?.topPaths?.[0]?.path ?? "-"}</div>
        </div>
      </div>

      <div className="td2-card rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="td2-input px-3 py-2 text-sm"
            placeholder={tx("Busca (rota, erro, ip...)", "Search (path, error, ip...)")}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <input
            className="td2-input px-3 py-2 text-sm"
            placeholder="userId"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
          />
          <input
            className="td2-input px-3 py-2 text-sm"
            placeholder="/api/admin/..."
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            className="td2-select px-3 py-2 text-sm"
            value={ok}
            onChange={(e) => {
              setOk(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="">{tx("Todos", "All")}</option>
            <option value="true">{tx("Sucesso", "Success")}</option>
            <option value="false">{tx("Falha", "Failure")}</option>
          </select>
          <input
            type="datetime-local"
            className="td2-input px-3 py-2 text-sm"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="datetime-local"
            className="td2-input px-3 py-2 text-sm"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
          <button
            className="td2-btn px-3 py-2 text-sm"
            onClick={() => {
              setQ("");
              setUserId("");
              setPath("");
              setOk("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            {tx("Limpar filtros", "Clear filters")}
          </button>
        </div>

        <div className="overflow-auto rounded-xl border border-slate-800/70">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-900/40">
              <tr>
                <th className="text-left px-3 py-2">{tx("Data", "Date")}</th>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">IP</th>
                <th className="text-left px-3 py-2">{tx("Método", "Method")}</th>
                <th className="text-left px-3 py-2">Path</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">{tx("Duração", "Duration")}</th>
                <th className="text-left px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <tr><td className="px-3 py-3 td2-muted" colSpan={8}>{tx("Carregando...", "Loading...")}</td></tr>
              ) : null}
              {list.isError ? (
                <tr><td className="px-3 py-3 text-red-300" colSpan={8}>{String((list.error as any)?.message ?? "Error")}</td></tr>
              ) : null}
              {!list.isLoading && !list.isError && rows.length === 0 ? (
                <tr><td className="px-3 py-3 td2-muted" colSpan={8}>{tx("Sem registros.", "No records.")}</td></tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-900/80">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.userId ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.ip ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.method}</td>
                  <td className="px-3 py-2">{r.path}</td>
                  <td className={`px-3 py-2 whitespace-nowrap ${r.ok ? "text-emerald-300" : "text-red-300"}`}>
                    {r.status}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.durationMs}ms</td>
                  <td className="px-3 py-2">{r.error ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs td2-muted">
            {tx("Página", "Page")} {list.data?.page ?? page} / {totalPages} · {tx("Total", "Total")}: {list.data?.total ?? 0}
          </div>
          <div className="flex gap-2">
            <button className="td2-btn px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {tx("Anterior", "Prev")}
            </button>
            <button className="td2-btn px-3 py-1.5 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {tx("Próxima", "Next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

