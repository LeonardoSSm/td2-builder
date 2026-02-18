import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiUpload } from "../../api/http";
import { useI18n } from "../../i18n";

type ImportJob = {
  id: string;
  kind: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
  progress: number;
  totalSteps: number;
  processedSteps: number;
  attempt: number;
  maxAttempts: number;
  report?: any;
  error?: string | null;
  requestedBy?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(v?: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function statusLabel(s: ImportJob["status"], tx: (pt: string, en: string) => string) {
  if (s === "QUEUED") return tx("Na fila", "Queued");
  if (s === "PROCESSING") return tx("Processando", "Processing");
  if (s === "DONE") return tx("Concluído", "Done");
  return tx("Falhou", "Failed");
}

export default function AdminImportPage() {
  const { tx } = useI18n();
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const jobs = useQuery({
    queryKey: ["import-jobs"],
    queryFn: () => apiGet<ImportJob[]>("/imports/jobs?limit=20"),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (activeJobId) return;
    const first = jobs.data?.[0]?.id;
    if (first) setActiveJobId(first);
  }, [jobs.data, activeJobId]);

  const activeJob = useQuery({
    queryKey: ["import-job", activeJobId],
    enabled: !!activeJobId,
    queryFn: () => apiGet<ImportJob>(`/imports/jobs/${activeJobId}`),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (!s) return 1500;
      if (s === "DONE" || s === "FAILED") return false;
      return 1200;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo .xlsx");
      return apiUpload<ImportJob>("/imports/xlsx", file);
    },
    onSuccess: async (job) => {
      setActiveJobId(job.id);
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["import-jobs"] });
      await qc.invalidateQueries({ queryKey: ["import-job", job.id] });
    },
  });

  const retry = useMutation({
    mutationFn: async (id: string) => apiPost<{ ok: boolean; job?: ImportJob; error?: string }>(`/imports/jobs/${id}/retry`, {}),
    onSuccess: async (res, id) => {
      if (res?.job?.id) setActiveJobId(res.job.id);
      else setActiveJobId(id);
      await qc.invalidateQueries({ queryKey: ["import-jobs"] });
      await qc.invalidateQueries({ queryKey: ["import-job", id] });
    },
  });

  const uploadError = upload.error ? (upload.error as any)?.message ?? String(upload.error) : null;
  const retryError = retry.error ? (retry.error as any)?.message ?? String(retry.error) : null;

  const selectedJob = activeJob.data ?? (activeJobId ? jobs.data?.find((j) => j.id === activeJobId) : undefined) ?? null;

  const progressPct = useMemo(() => {
    if (!selectedJob) return 0;
    return Math.max(0, Math.min(100, Number(selectedJob.progress ?? 0)));
  }, [selectedJob]);

  return (
    <div className="td2-page space-y-4">
      <div>
        <div className="td2-heading text-lg font-semibold">Admin</div>
        <div className="text-xs td2-subheading">{tx("Importar XLSX em fila (com progresso e retry)", "Queue XLSX imports (with progress and retry)")}</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="td2-card rounded-2xl p-4 space-y-3 xl:col-span-2">
          <div className="td2-heading text-sm font-medium">{tx("Novo upload", "New upload")}</div>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />

          <button
            disabled={!file || upload.isPending}
            onClick={() => upload.mutate()}
            className="td2-btn px-4 py-2 disabled:opacity-50 text-sm"
          >
            {upload.isPending ? tx("Enfileirando...", "Queueing...") : tx("Importar", "Import")}
          </button>

          <div className="text-xs td2-muted">
            {tx("Dica: use o arquivo de exemplo em", "Tip: use the sample file in")} <code className="td2-code px-1.5 py-0.5">/data</code>.
          </div>

          {uploadError ? (
            <div className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-xs text-red-200">{uploadError}</div>
          ) : null}

          {retryError ? (
            <div className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-xs text-red-200">{retryError}</div>
          ) : null}
        </div>

        <div className="td2-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="td2-heading text-sm font-medium">{tx("Job ativo", "Active job")}</div>
            <button className="td2-btn text-xs px-2 py-1" onClick={() => jobs.refetch()}>{tx("Atualizar", "Refresh")}</button>
          </div>

          {!selectedJob ? <div className="text-xs td2-muted">{tx("Sem jobs recentes.", "No recent jobs.")}</div> : (
            <div className="space-y-3">
              <div className="text-xs td2-muted">
                <span className="font-mono">{selectedJob.id}</span> · {selectedJob.filename}
              </div>
              <div className="text-xs td2-muted">{statusLabel(selectedJob.status, tx)} · {progressPct}%</div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-orange-500 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-xs td2-muted">
                {tx("Etapas", "Steps")}: {selectedJob.processedSteps}/{selectedJob.totalSteps} · {tx("Tentativas", "Attempts")}: {selectedJob.attempt}/{selectedJob.maxAttempts}
              </div>
              <div className="text-xs td2-muted">
                {tx("Início", "Start")}: {formatDate(selectedJob.startedAt)}
              </div>
              <div className="text-xs td2-muted">
                {tx("Fim", "End")}: {formatDate(selectedJob.finishedAt)}
              </div>
              {selectedJob.status === "FAILED" ? (
                <div className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-xs text-red-200">
                  {selectedJob.error || tx("Falha sem mensagem", "Failed without message")}
                </div>
              ) : null}
              {selectedJob.status === "FAILED" && selectedJob.attempt < selectedJob.maxAttempts ? (
                <button
                  className="td2-btn text-xs px-3 py-2"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(selectedJob.id)}
                >
                  {retry.isPending ? tx("Reenfileirando...", "Requeueing...") : tx("Tentar novamente", "Retry")}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <div className="td2-card rounded-2xl p-4">
          <div className="td2-heading text-sm font-medium mb-2">{tx("Resultado", "Result")}</div>
          {selectedJob?.report ? (
            <pre className="text-xs overflow-auto whitespace-pre-wrap text-slate-200 td2-code p-3">{JSON.stringify(selectedJob.report, null, 2)}</pre>
          ) : (
            <div className="text-xs td2-muted">{tx("Sem resultado ainda.", "No result yet.")}</div>
          )}
        </div>

        <div className="td2-card rounded-2xl p-4">
          <div className="td2-heading text-sm font-medium mb-2">{tx("Histórico recente", "Recent history")}</div>
          {jobs.isLoading ? <div className="text-xs td2-muted">{tx("Carregando...", "Loading...")}</div> : null}
          {jobs.isError ? <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(jobs.error as any)?.message}</div> : null}
          <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
            {(jobs.data ?? []).map((j) => (
              <div key={j.id} className={`rounded-xl border p-3 text-xs ${activeJobId === j.id ? "border-orange-600 bg-orange-950/15" : "border-slate-800 bg-slate-900/30"}`}>
                <div className="flex items-center justify-between gap-2">
                  <button className="text-left td2-link" onClick={() => setActiveJobId(j.id)}>
                    <span className="font-mono">{j.id}</span>
                  </button>
                  <span className="td2-muted">{statusLabel(j.status, tx)}</span>
                </div>
                <div className="td2-muted mt-1">{j.filename}</div>
                <div className="td2-muted mt-1">{j.progress}% · {j.processedSteps}/{j.totalSteps}</div>
                <div className="td2-muted mt-1">{formatDate(j.createdAt)}</div>
                {j.status === "FAILED" && j.attempt < j.maxAttempts ? (
                  <button className="td2-btn text-[11px] px-2 py-1 mt-2" onClick={() => retry.mutate(j.id)} disabled={retry.isPending}>
                    {tx("Retry", "Retry")}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
