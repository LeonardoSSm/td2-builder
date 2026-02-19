import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/http";
import { useI18n } from "../../i18n";

type TimelineBucket = { ts: string; total: number; failed: number };
type MonitorRequest = {
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
type MonitorLogin = {
  id: string;
  at: string;
  userId: string | null;
  email: string | null;
  ip: string | null;
  status: number;
  ok: boolean;
};
type MonitorResponse = {
  ok: boolean;
  ts: string;
  service: { name: string; node: string; pid: number; uptimeSec: number; startedAt: string };
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number; externalMb: number };
  database: { ready: boolean };
  queue: { queued: number; processing: number; failed: number; done: number } | null;
  recentJobs: Array<{ id: string; filename: string; status: string; progress: number; createdAt: string; updatedAt: string }>;
  counts: { gearItems: number; weapons: number; builds: number; users: number; maps: number } | null;
  audit1h: { total: number; success: number; failed: number; err5xx: number; rpsApprox: number; avgMs: number; p95Ms: number } | null;
  audit24h: { total: number; failed: number; success: number } | null;
  errors24h: { total: number; err4xx: number; err5xx: number; other: number } | null;
  login24h: { total: number; success: number; failed: number; uniqueUsers: number } | null;
  topUsers24h: Array<{
    identity: string;
    userId: string | null;
    email: string | null;
    ip: string | null;
    total: number;
    failed: number;
    err4xx: number;
    err5xx: number;
    lastAt: string;
  }>;
  timeline1h: TimelineBucket[];
  timeline24h: TimelineBucket[];
  topPaths24h: Array<{ path: string; count: number }>;
  recentRequests: MonitorRequest[];
  recentLogins: MonitorLogin[];
};

function kfmt(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function StatCard({ title, value, sub, danger }: { title: string; value: string | number; sub?: string; danger?: boolean }) {
  return (
    <div className="td2-card rounded-xl p-3">
      <div className="text-[11px] uppercase tracking-wide td2-muted">{title}</div>
      <div className={`text-xl font-semibold mt-1 ${danger ? "text-red-300" : ""}`}>{value}</div>
      {sub ? <div className="text-[11px] td2-muted mt-1">{sub}</div> : null}
    </div>
  );
}

function Bars24h({ data }: { data: TimelineBucket[] }) {
  const max = Math.max(1, ...data.map((x) => x.total));
  return (
    <div className="h-32 flex items-end gap-1">
      {data.map((b) => {
        const h = Math.max(2, Math.round((b.total / max) * 100));
        const err = b.total ? b.failed / b.total : 0;
        return (
          <div key={b.ts} className="flex-1 min-w-[6px] group">
            <div
              className="w-full rounded-sm bg-gradient-to-t from-cyan-500/50 to-cyan-300/70 border border-cyan-300/20"
              style={{ height: `${h}%`, boxShadow: err > 0.2 ? "0 0 0 1px rgba(248,113,113,.4) inset" : undefined }}
              title={`${new Date(b.ts).toLocaleTimeString()} · total ${b.total} · fail ${b.failed}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function Line1h({ data }: { data: TimelineBucket[] }) {
  const w = 720;
  const h = 140;
  const p = 8;
  const max = Math.max(1, ...data.map((x) => x.total));
  const points = data
    .map((b, i) => {
      const x = p + (i / Math.max(1, data.length - 1)) * (w - p * 2);
      const y = h - p - (b.total / max) * (h - p * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36 rounded-lg bg-slate-950/30 border border-slate-800/60">
      <polyline fill="none" stroke="rgba(56,189,248,.95)" strokeWidth="2" points={points} />
      <polyline
        fill="none"
        stroke="rgba(248,113,113,.9)"
        strokeWidth="1.5"
        points={data
          .map((b, i) => {
            const x = p + (i / Math.max(1, data.length - 1)) * (w - p * 2);
            const y = h - p - ((b.failed || 0) / max) * (h - p * 2);
            return `${x},${y}`;
          })
          .join(" ")}
      />
    </svg>
  );
}

export default function AdminMonitorPage() {
  const { tx } = useI18n();
  const [refreshMs, setRefreshMs] = useState(10_000);
  const [takeRequests, setTakeRequests] = useState(120);
  const [takeLogins, setTakeLogins] = useState(40);

  const q = useQuery({
    queryKey: ["admin-monitor", refreshMs, takeRequests, takeLogins],
    queryFn: () => apiGet<MonitorResponse>(`/admin/monitor?takeRequests=${takeRequests}&takeLogins=${takeLogins}`),
    refetchInterval: refreshMs,
  });

  const d = q.data;
  const reqRows = useMemo(() => (d?.recentRequests ?? []).slice(0, takeRequests), [d, takeRequests]);
  const loginRows = useMemo(() => (d?.recentLogins ?? []).slice(0, takeLogins), [d, takeLogins]);

  return (
    <div className="td2-page space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="td2-heading text-lg font-semibold">{tx("Admin Monitor", "Admin Monitor")}</div>
          <div className="text-xs td2-subheading mt-1">
            {tx("Métricas em tempo real, requisições da API e atividade de login.", "Real-time metrics, API requests and login activity.")}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select className="td2-select px-3 py-2 text-xs" value={String(refreshMs)} onChange={(e) => setRefreshMs(Number(e.target.value) || 10_000)}>
            <option value="5000">Auto 5s</option>
            <option value="10000">Auto 10s</option>
            <option value="30000">Auto 30s</option>
            <option value="0">Manual</option>
          </select>
          <button className="td2-btn px-3 py-2 text-xs" onClick={() => q.refetch()}>{tx("Atualizar", "Refresh")}</button>
        </div>
      </div>

      {q.isLoading ? <div className="td2-card rounded-xl p-3 text-sm td2-muted">{tx("Carregando...", "Loading...")}</div> : null}
      {q.isError ? <div className="td2-card rounded-xl p-3 text-sm text-red-300">{String((q.error as any)?.message ?? "Error")}</div> : null}

      {d ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={tx("DB", "DB")} value={d.database.ready ? tx("Online", "Online") : tx("Offline", "Offline")} danger={!d.database.ready} />
            <StatCard title={tx("Uptime", "Uptime")} value={`${d.service.uptimeSec}s`} sub={`${tx("Node", "Node")} ${d.service.node}`} />
            <StatCard title={tx("Req (1h)", "Req (1h)")} value={kfmt(d.audit1h?.total ?? 0)} sub={`RPS~ ${d.audit1h?.rpsApprox ?? 0}`} />
            <StatCard title={tx("Latência", "Latency")} value={`${d.audit1h?.avgMs ?? 0}ms`} sub={`P95 ${d.audit1h?.p95Ms ?? 0}ms`} danger={Boolean((d.audit1h?.p95Ms ?? 0) > 800)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={tx("Queue queued", "Queue queued")} value={d.queue?.queued ?? "-"} />
            <StatCard title={tx("Queue processing", "Queue processing")} value={d.queue?.processing ?? "-"} />
            <StatCard title={tx("Queue failed", "Queue failed")} value={d.queue?.failed ?? "-"} danger={Boolean((d.queue?.failed ?? 0) > 0)} />
            <StatCard title={tx("5xx (1h)", "5xx (1h)")} value={d.audit1h?.err5xx ?? "-"} danger={Boolean((d.audit1h?.err5xx ?? 0) > 0)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={tx("Logins 24h", "Logins 24h")} value={d.login24h?.total ?? 0} />
            <StatCard title={tx("Sucesso login", "Login success")} value={d.login24h?.success ?? 0} />
            <StatCard title={tx("Falha login", "Login failed")} value={d.login24h?.failed ?? 0} danger={Boolean((d.login24h?.failed ?? 0) > 0)} />
            <StatCard title={tx("Usuários únicos 24h", "Unique users 24h")} value={d.login24h?.uniqueUsers ?? 0} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={tx("4xx (24h)", "4xx (24h)")} value={d.errors24h?.err4xx ?? 0} danger={Boolean((d.errors24h?.err4xx ?? 0) > 0)} />
            <StatCard title={tx("5xx (24h)", "5xx (24h)")} value={d.errors24h?.err5xx ?? 0} danger={Boolean((d.errors24h?.err5xx ?? 0) > 0)} />
            <StatCard title={tx("OK/Outros (24h)", "OK/Other (24h)")} value={d.errors24h?.other ?? 0} />
            <StatCard title={tx("Total API (24h)", "Total API (24h)")} value={d.errors24h?.total ?? 0} />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="td2-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{tx("Tráfego 24h (barras)", "24h traffic (bars)")}</div>
                <div className="text-xs td2-muted">{tx("Total", "Total")}: {d.timeline24h.reduce((a, b) => a + b.total, 0)}</div>
              </div>
              <Bars24h data={d.timeline24h ?? []} />
            </div>

            <div className="td2-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{tx("Última 1h (linha)", "Last 1h (line)")}</div>
                <div className="text-xs td2-muted">{tx("Vermelho = falhas", "Red = failures")}</div>
              </div>
              <Line1h data={d.timeline1h ?? []} />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="td2-card rounded-2xl p-4 space-y-3">
              <div className="text-sm font-semibold">{tx("Top rotas (24h)", "Top paths (24h)")}</div>
              <div className="space-y-2">
                {(d.topPaths24h ?? []).map((p) => (
                  <div key={p.path} className="text-xs">
                    <div className="flex justify-between"><span className="truncate pr-3">{p.path}</span><span>{p.count}</span></div>
                    <div className="h-1.5 rounded bg-slate-900/70 mt-1">
                      <div
                        className="h-full rounded bg-gradient-to-r from-cyan-400/80 to-blue-400/80"
                        style={{
                          width: `${Math.max(2, Math.round((p.count / Math.max(1, d.topPaths24h?.[0]?.count ?? 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="td2-card rounded-2xl p-4 space-y-3">
              <div className="text-sm font-semibold">{tx("Contagem de dados", "Data counts")}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>{tx("Gear items", "Gear items")}: <span className="font-semibold">{d.counts?.gearItems ?? "-"}</span></div>
                <div>{tx("Armas", "Weapons")}: <span className="font-semibold">{d.counts?.weapons ?? "-"}</span></div>
                <div>{tx("Builds", "Builds")}: <span className="font-semibold">{d.counts?.builds ?? "-"}</span></div>
                <div>{tx("Usuários", "Users")}: <span className="font-semibold">{d.counts?.users ?? "-"}</span></div>
                <div>{tx("Mapas", "Maps")}: <span className="font-semibold">{d.counts?.maps ?? "-"}</span></div>
              </div>
            </div>
          </div>

          <div className="td2-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{tx("Top usuários por requests (24h)", "Top users by requests (24h)")}</div>
              <div className="text-xs td2-muted">{tx("Inclui usuário autenticado, email (login) ou IP", "Includes authenticated user, login email, or IP")}</div>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-800/70">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900/40">
                  <tr>
                    <th className="text-left px-3 py-2">{tx("Identidade", "Identity")}</th>
                    <th className="text-left px-3 py-2">{tx("Usuário", "User")}</th>
                    <th className="text-left px-3 py-2">Email</th>
                    <th className="text-left px-3 py-2">IP</th>
                    <th className="text-left px-3 py-2">{tx("Total", "Total")}</th>
                    <th className="text-left px-3 py-2">{tx("Falhas", "Failed")}</th>
                    <th className="text-left px-3 py-2">4xx</th>
                    <th className="text-left px-3 py-2">5xx</th>
                    <th className="text-left px-3 py-2">{tx("Última atividade", "Last activity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.topUsers24h ?? []).map((u) => (
                    <tr key={u.identity} className="border-t border-slate-900/80">
                      <td className="px-3 py-2 whitespace-nowrap">{u.identity}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{u.userId ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{u.email ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{u.ip ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{u.total}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${u.failed > 0 ? "text-red-300" : ""}`}>{u.failed}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${u.err4xx > 0 ? "text-amber-300" : ""}`}>{u.err4xx}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${u.err5xx > 0 ? "text-red-300" : ""}`}>{u.err5xx}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(u.lastAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!d.topUsers24h?.length ? <tr><td className="px-3 py-3 td2-muted" colSpan={9}>{tx("Sem dados.", "No data.")}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="td2-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{tx("Requisições recentes da API", "Recent API requests")}</div>
              <select className="td2-select px-3 py-1.5 text-xs" value={String(takeRequests)} onChange={(e) => setTakeRequests(Number(e.target.value) || 120)}>
                <option value="60">60</option>
                <option value="120">120</option>
                <option value="200">200</option>
              </select>
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
                  </tr>
                </thead>
                <tbody>
                  {reqRows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-900/80">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.userId ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.ip ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.method}</td>
                      <td className="px-3 py-2 max-w-[360px] truncate">{r.path}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${r.ok ? "text-emerald-300" : "text-red-300"}`}>{r.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.durationMs}ms</td>
                    </tr>
                  ))}
                  {!reqRows.length ? <tr><td className="px-3 py-3 td2-muted" colSpan={7}>{tx("Sem dados.", "No data.")}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="td2-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{tx("Usuários que logaram", "Users who logged in")}</div>
              <select className="td2-select px-3 py-1.5 text-xs" value={String(takeLogins)} onChange={(e) => setTakeLogins(Number(e.target.value) || 40)}>
                <option value="20">20</option>
                <option value="40">40</option>
                <option value="80">80</option>
              </select>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-800/70">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900/40">
                  <tr>
                    <th className="text-left px-3 py-2">{tx("Data", "Date")}</th>
                    <th className="text-left px-3 py-2">{tx("Usuário", "User")}</th>
                    <th className="text-left px-3 py-2">Email</th>
                    <th className="text-left px-3 py-2">IP</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loginRows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-900/80">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.userId ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.email ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.ip ?? "-"}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${r.ok ? "text-emerald-300" : "text-red-300"}`}>{r.status}</td>
                    </tr>
                  ))}
                  {!loginRows.length ? <tr><td className="px-3 py-3 td2-muted" colSpan={5}>{tx("Sem logins recentes.", "No recent logins.")}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
