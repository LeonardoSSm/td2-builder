import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { apiGet, apiPost, apiPut } from "../api/http";
import { useNavigate } from "react-router-dom";
import AsyncCatalogCombo from "./AsyncCatalogCombo";

type ChatMsg = { id: string; role: "user" | "assistant"; text: string };

type RecommendedBuild = {
  id: string;
  name: string;
  description: string;
  focus: "DPS" | "Tank" | "Skill";
  preferredCore: "Red" | "Blue" | "Yellow";
  slots?: Array<{ slot: string; itemId: string | null; itemName: string | null }>;
  filledSlots: number;
  totalSlots: number;
  primaryWeaponName: string | null;
  secondaryWeaponName: string | null;
};

type Build = { id: string; name: string; slots: Array<{ slot: string; itemId?: string | null }> };

const SLOTS = ["Mask", "Chest", "Backpack", "Gloves", "Holster", "Kneepads"] as const;

function uid(prefix = "m") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function norm(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeBuildIntent(text: string): boolean {
  const t = norm(text);
  if (!t) return false;
  if (t.includes("quero montar uma build")) return true;
  if (t.includes("montar uma build")) return true;
  if (t.includes("montar build")) return true;
  if (t.includes("criar uma build")) return true;
  return false;
}

function buildHelpTextPt() {
  return [
    "Eu posso:",
    "- Sugerir builds recomendadas (Striker DPS, Tank, Skill)",
    "- Montar uma build por nome dos itens",
    "",
    'Digite: "Quero montar uma build" para abrir o formulário rápido.',
    'Ou: "Monte uma build do Agressor/Striker" para eu criar uma recomendada.',
  ].join("\n");
}

function parseHttpErrorMessage(msg: string): { status: number | null; body: string } {
  const m = String(msg ?? "");
  const match = m.match(/^HTTP\s+(\d+):\s*([\s\S]*)$/);
  if (!match) return { status: null, body: m };
  return { status: Number(match[1] ?? 0) || null, body: String(match[2] ?? "").trim() };
}

function tryParseJsonBody(body: string): any | null {
  const s = String(body ?? "").trim();
  if (!s) return null;
  if (!(s.startsWith("{") && s.endsWith("}"))) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractGeminiHttpStatus(detail: string): number | null {
  const s = String(detail ?? "");
  // AiService throws: `Gemini error (${status}): ${body}`
  const m = s.match(/Gemini error\\s*\\((\\d+)\\)/i);
  if (!m) return null;
  const code = Number(m[1]);
  return Number.isFinite(code) ? code : null;
}

function looksLikeCreateBuildFromRecommended(text: string): boolean {
  const t = norm(text);
  if (!t.includes("build")) return false;
  // Imperative verbs: user expects action (create now)
  return (
    t.includes("monte") ||
    t.includes("monta") ||
    t.includes("crie") ||
    t.includes("criar") ||
    t.includes("faz uma") ||
    t.includes("fazer uma") ||
    t.startsWith("build do ") ||
    t.startsWith("build de ")
  );
}

function guessRecommendedQuery(text: string): string {
  const t = norm(text);
  if (!t) return "";
  // Common PTBR aliases -> EN names used in profiles
  if (t.includes("agressor")) return "striker";
  if (t.includes("striker")) return "striker";
  if (t.includes("habilidade") || t.includes("skill")) return "skill";
  if (t.includes("tank")) return "tank";
  if (t.includes("dps")) return "dps";
  // fallback: strip generic words
  return t
    .replace(/\b(monte|monta|crie|criar|faz|fazer|uma|um|build|do|da|de|pra|para|com)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreRecommended(rec: RecommendedBuild, q: string): number {
  const query = norm(q);
  if (!query) return 0;
  const name = norm(rec.name);
  const desc = norm(rec.description);
  let score = 0;
  if (name.includes(query)) score += 10;
  if (desc.includes(query)) score += 5;
  if (query === "dps" && norm(rec.focus) === "dps") score += 8;
  if (query === "tank" && norm(rec.focus) === "tank") score += 8;
  if (query === "skill" && norm(rec.focus) === "skill") score += 8;
  // small bonus if it fills more slots
  score += Math.min(6, Math.max(0, rec.filledSlots)) * 0.2;
  return score;
}

function formatRecommendedBuildPreview(rec: RecommendedBuild): string {
  const lines: string[] = [];
  lines.push(`Build: ${rec.name}`);
  if (rec.description) lines.push(rec.description);
  lines.push(`${rec.focus} · Core: ${rec.preferredCore} · Slots: ${rec.filledSlots}/${rec.totalSlots}`);
  if (rec.primaryWeaponName || rec.secondaryWeaponName) {
    lines.push(`Armas: ${rec.primaryWeaponName ?? "-"} | ${rec.secondaryWeaponName ?? "-"}`);
  }
  if (rec.slots?.length) {
    lines.push("Gear:");
    for (const s of rec.slots) {
      lines.push(`- ${s.slot}: ${s.itemName ?? "(vazio)"}`);
    }
  }
  return lines.join("\n");
}

async function resolveGearItemIdByName(slot: string, name: string): Promise<string | null> {
  const q = String(name ?? "").trim();
  if (!q) return null;
  const url = `/catalog/gear-items?slot=${encodeURIComponent(slot)}&q=${encodeURIComponent(q)}&take=10`;
  const res = await apiGet<{ items: Array<{ id: string; name: string }>; total: number }>(url);
  const items = res.items ?? [];
  const wanted = norm(q);
  const exact = items.find((it) => norm(it.name) === wanted);
  return (exact ?? items[0])?.id ?? null;
}

async function resolveWeaponIdByName(name: string): Promise<string | null> {
  const q = String(name ?? "").trim();
  if (!q) return null;
  const url = `/catalog/weapons?q=${encodeURIComponent(q)}&take=10`;
  const res = await apiGet<{ items: Array<{ id: string; name: string }>; total: number }>(url);
  const items = res.items ?? [];
  const wanted = norm(q);
  const exact = items.find((it) => norm(it.name) === wanted);
  return (exact ?? items[0])?.id ?? null;
}

export default function ChatWidget() {
  const { tx, lang } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    { id: uid("a"), role: "assistant", text: tx(buildHelpTextPt(), buildHelpTextPt()) },
  ]);
  const [mode, setMode] = useState<"chat" | "buildForm">("chat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [buildName, setBuildName] = useState<string>(tx("Minha Build", "My Build"));
  const [gearNames, setGearNames] = useState<Record<string, string>>(() => Object.fromEntries(SLOTS.map((s) => [s, ""])));
  const [gearPicked, setGearPicked] = useState<Record<string, string | null>>(() => Object.fromEntries(SLOTS.map((s) => [s, null])));
  const [primaryWeaponName, setPrimaryWeaponName] = useState("");
  const [secondaryWeaponName, setSecondaryWeaponName] = useState("");
  const [primaryWeaponPicked, setPrimaryWeaponPicked] = useState<string | null>(null);
  const [secondaryWeaponPicked, setSecondaryWeaponPicked] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (mode === "buildForm") {
      const hasAnyGear = SLOTS.some((s) => String(gearNames[s] ?? "").trim().length > 0);
      const hasAnyWeapon = String(primaryWeaponName).trim() || String(secondaryWeaponName).trim();
      return Boolean(String(buildName).trim()) && (hasAnyGear || hasAnyWeapon);
    }
    return Boolean(draft.trim());
  }, [busy, mode, gearNames, buildName, primaryWeaponName, secondaryWeaponName, draft]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pushAssistant = (text: string) => {
    setMessages((m) => [...m, { id: uid("a"), role: "assistant", text }]);
  };

  const onSend = async () => {
    setError(null);
    const text = draft.trim();
    if (!text) return;

    setMessages((m) => [...m, { id: uid("u"), role: "user", text }]);
    setDraft("");

    if (looksLikeBuildIntent(text)) {
      setMode("buildForm");
      pushAssistant(tx("Beleza. Preencha os nomes dos itens e eu crio a build pra você.", "Great. Fill the item names and I will create the build for you."));
      return;
    }

    // If user asks to create a known recommended build (ex: Agressor/Striker), do it deterministically instead of calling the model.
    if (looksLikeCreateBuildFromRecommended(text)) {
      const q = guessRecommendedQuery(text);
      try {
        const list = recommendedState.data ?? (await apiGet<RecommendedBuild[]>("/builds/recommended"));
        const best = (list ?? [])
          .map((rec) => ({ rec, score: scoreRecommended(rec, q) }))
          .sort((a, b) => b.score - a.score)[0]?.rec;

        if (best && scoreRecommended(best, q) >= 6) {
          pushAssistant(tx(`Achei uma build recomendada que combina com seu pedido:\n${formatRecommendedBuildPreview(best)}\nVou criar agora.`, `Found a recommended build that matches:\n${formatRecommendedBuildPreview(best)}\nCreating now.`));
          await onApplyRecommended(best);
          return;
        }

        // Fall back: guide user to the list or the quick form.
        pushAssistant(
          tx(
            'Não encontrei uma recomendada que bate com isso. Você pode clicar em uma das "Recomendadas" abaixo, ou digitar "Quero montar uma build" para preencher por nomes.',
            'I could not find a matching recommended build. You can click one of the "Recommended" below, or type "I want to create a build" to fill by names.',
          ),
        );
        return;
      } catch {
        // If API fails, continue to model chat as a fallback.
      }
    }

    // Small helper: show recommended builds when user asks for suggestions.
    const t = norm(text);
    if (t.includes("sugest") || t.includes("recomend") || t.includes("build recomend")) {
      pushAssistant(tx("Quer que eu aplique uma build recomendada ou você quer montar por nomes? Use os botões abaixo.", "Do you want to apply a recommended build or build by names? Use the buttons below."));
      return;
    }

    setBusy(true);
    try {
      const history = messages
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text }))
        .filter((m) => m.text && (m.role === "user" || m.role === "assistant"));

      const res = await apiPost<{ text: string }>("/ai/chat", { message: text, history, lang });
      const out = String(res?.text ?? "").trim();
      pushAssistant(out || tx("Sem resposta do modelo.", "No model response."));
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      const { status, body } = parseHttpErrorMessage(msg);
      const bodyJson = tryParseJsonBody(body);
      const detail = String(bodyJson?.message ?? body ?? "").trim();

      if (status === 401 || msg.toLowerCase().includes("unauthorized")) {
        pushAssistant(tx("Para usar a IA, faça login primeiro (Admin).", "To use AI, please sign in first (Admin)."));
      } else if (status === 403 || msg.toLowerCase().includes("forbidden")) {
        pushAssistant(tx("Sem permissão para usar a IA (somente Admin).", "You don't have permission to use AI (Admin only)."));
      } else if (status === 429 || msg.toLowerCase().includes("too many")) {
        pushAssistant(tx("Muitas mensagens em pouco tempo. Aguarde e tente novamente.", "Too many requests. Please wait and try again."));
      } else if (status === 503 && detail.toLowerCase().includes("gemini_api_key")) {
        pushAssistant(
          tx(
            "IA desativada no servidor (GEMINI_API_KEY não configurada). Configure e reinicie a API.",
            "AI is disabled on the server (GEMINI_API_KEY is not configured). Configure it and restart the API.",
          ),
        );
      } else if (status === 503 && detail.toLowerCase().includes("failed to reach gemini")) {
        pushAssistant(
          tx(
            "IA indisponível: o servidor não conseguiu acessar o Gemini (internet/DNS/SSL).",
            "AI unavailable: the server could not reach Gemini (internet/DNS/SSL).",
          ),
        );
      } else if (status === 502 && detail.toLowerCase().includes("gemini error")) {
        const geminiStatus = extractGeminiHttpStatus(detail);
        if (geminiStatus === 400) {
          pushAssistant(
            tx(
              "IA indisponível: requisição inválida (Gemini 400). Verifique o `GEMINI_MODEL` e os dados enviados.",
              "AI unavailable: invalid request (Gemini 400). Check `GEMINI_MODEL` and the request payload.",
            ),
          );
          return;
        }
        if (geminiStatus === 401 || geminiStatus === 403) {
          pushAssistant(
            tx(
              "IA indisponível: chave do Gemini inválida ou bloqueada (Gemini 401/403).\n- Confirme se a API do Gemini/Generative Language está habilitada no projeto.\n- Em Credenciais, deixe a chave sem restrição de referrer (para backend) ou use restrição por IP do servidor.\n- Se houver restrição de API, permita a API do Gemini/Generative Language.",
              "AI unavailable: Gemini key is invalid or blocked (Gemini 401/403).\n- Ensure Gemini/Generative Language API is enabled.\n- In credentials, remove HTTP referrer restriction (backend) or restrict by server IP.\n- If API restrictions are enabled, allow Gemini/Generative Language API.",
            ),
          );
          return;
        }
        if (geminiStatus === 404) {
          pushAssistant(
            tx(
              "IA indisponível: modelo não encontrado (Gemini 404). Atualize o `GEMINI_MODEL` no `.env` (ex: `gemini-2.5-flash`) e reinicie a API.",
              "AI unavailable: model not found (Gemini 404). Update `GEMINI_MODEL` in `.env` (e.g. `gemini-2.5-flash`) and restart the API.",
            ),
          );
          return;
        }
        if (geminiStatus === 429) {
          pushAssistant(
            tx(
              "IA indisponível: limite/quota atingida no Gemini (429). Aguarde um pouco ou reduza a frequência de mensagens.",
              "AI unavailable: Gemini quota/rate limit hit (429). Wait a bit or reduce message frequency.",
            ),
          );
          return;
        }
        // Fallback: show a short, safe excerpt so user can see what Gemini complained about.
        const excerpt = detail.length > 260 ? `${detail.slice(0, 260)}...` : detail;
        pushAssistant(
          tx(
            `IA indisponível: o Gemini recusou a requisição${geminiStatus ? ` (${geminiStatus})` : ""}.\nDetalhes: ${excerpt}\nVerifique chave/modelo/quota e se a API está habilitada.`,
            `AI unavailable: Gemini rejected the request${geminiStatus ? ` (${geminiStatus})` : ""}.\nDetails: ${excerpt}\nCheck key/model/quota and that the API is enabled.`,
          ),
        );
      } else if (msg.toLowerCase().includes("network error: could not reach api")) {
        pushAssistant(
          tx(
            "Sem conexão com a API agora. Verifique se a API está rodando e se o Web está apontando para `/api`.",
            "No connection to the API right now. Check if the API is running and the Web is pointing to `/api`.",
          ),
        );
      } else {
        pushAssistant(
          tx(
            'Sem IA no momento. Se você quiser montar rápido, digite "Quero montar uma build".',
            'AI is unavailable right now. If you want a quick build, type "I want to create a build".',
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const [recommendedState, setRecommendedState] = useState<{
    loading: boolean;
    error: string | null;
    data: RecommendedBuild[] | null;
  }>({ loading: false, error: null, data: null });

  useEffect(() => {
    if (!open) return;
    if (recommendedState.data || recommendedState.loading) return;
    setRecommendedState({ loading: true, error: null, data: null });
    apiGet<RecommendedBuild[]>("/builds/recommended")
      .then((data) => setRecommendedState({ loading: false, error: null, data }))
      .catch((e: any) => setRecommendedState({ loading: false, error: e?.message ?? "Error", data: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onApplyRecommended = async (rec: RecommendedBuild) => {
    setError(null);
    setBusy(true);
    try {
      const build = await apiPost<Build>(`/builds/recommended/${rec.id}/apply`, { name: `${tx("Build Recomendada", "Recommended Build")} - ${rec.name}` });
      setOpen(false);
      navigate(`/build?id=${encodeURIComponent(build.id)}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onCreateBuildFromNames = async () => {
    setError(null);
    setBusy(true);
    try {
      const b = await apiPost<Build>("/builds", { name: String(buildName).trim() });

      const slotsPayload: Array<{ slot: string; itemId: string | null }> = [];
      for (const slot of SLOTS) {
        const name = String(gearNames[slot] ?? "").trim();
        if (!name) continue;
        const pickedId = gearPicked[slot] ? String(gearPicked[slot]) : null;
        const itemId = pickedId || (await resolveGearItemIdByName(slot, name));
        slotsPayload.push({ slot, itemId });
      }

      const primaryId = primaryWeaponPicked || (await resolveWeaponIdByName(primaryWeaponName));
      const secondaryId = secondaryWeaponPicked || (await resolveWeaponIdByName(secondaryWeaponName));

      await apiPut<Build>(`/builds/${b.id}`, {
        slots: slotsPayload,
        primaryWeaponId: primaryId || null,
        secondaryWeaponId: secondaryId || null,
      });

      setOpen(false);
      navigate(`/build?id=${encodeURIComponent(b.id)}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="td2-chatfab"
        onClick={() => setOpen((v) => !v)}
        aria-label={tx("Abrir chat", "Open chat")}
        title={tx("Assistente", "Assistant")}
      >
        {open ? "×" : "AI"}
      </button>

      {open ? (
        <div className="td2-chatpanel" role="dialog" aria-label={tx("Assistente de Builds", "Build Assistant")}>
          <div className="td2-chatpanel__header">
            <div>
              <div className="td2-chatpanel__title">{tx("Assistente", "Assistant")}</div>
              <div className="td2-chatpanel__sub">{tx("Sugestões e criação rápida de builds", "Suggestions and quick build creation")}</div>
            </div>
            <div className="td2-chatpanel__headerActions">
              <button
                className={`td2-chip td2-chatpanel__mode ${mode === "chat" ? "td2-chatpanel__mode--active" : ""}`}
                onClick={() => setMode("chat")}
              >
                {tx("Chat", "Chat")}
              </button>
              <button
                className={`td2-chip td2-chatpanel__mode ${mode === "buildForm" ? "td2-chatpanel__mode--active" : ""}`}
                onClick={() => setMode("buildForm")}
              >
                {tx("Montar", "Build")}
              </button>
            </div>
          </div>

          <div ref={listRef} className="td2-chatpanel__body">
            {mode === "chat" ? (
              <>
                <div className="td2-chatpanel__msgs">
                  {messages.map((m) => (
                    <div key={m.id} className={`td2-chatmsg td2-chatmsg--${m.role}`}>
                      <div className="td2-chatmsg__bubble">
                        {m.text.split("\n").map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="td2-chatpanel__recommended">
                  <div className="td2-chatpanel__sectionTitle">{tx("Recomendadas", "Recommended")}</div>
                  {recommendedState.loading ? (
                    <div className="text-xs td2-muted">{tx("Carregando...", "Loading...")}</div>
                  ) : recommendedState.error ? (
                    <div className="text-xs text-red-300">{recommendedState.error}</div>
                  ) : (
                    <div className="td2-chatpanel__reclist">
                      {(recommendedState.data ?? []).slice(0, 3).map((rec) => (
                        <button
                          key={rec.id}
                          className="td2-chatrec"
                          disabled={busy}
                          onClick={() => onApplyRecommended(rec)}
                          title={tx("Aplicar build", "Apply build")}
                        >
                          <div className="td2-chatrec__name">{rec.name}</div>
                          <div className="td2-chatrec__meta">
                            {rec.focus} · {tx("Core", "Core")}: {rec.preferredCore} · {rec.filledSlots}/{rec.totalSlots}
                          </div>
                        </button>
                      ))}
                      {(recommendedState.data?.length ?? 0) === 0 ? (
                        <div className="text-xs td2-muted">
                          {tx("Sem builds recomendadas no momento.", "No recommended builds right now.")}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="td2-chatpanel__form">
                <div className="td2-chatpanel__sectionTitle">{tx("Montagem rápida", "Quick build")}</div>
                <div className="td2-chatpanel__hint">
                  {tx(
                    "Dica: pode escrever nomes parciais. Eu tento achar o melhor match no catálogo.",
                    "Tip: you can type partial names. I will try to match in the catalog.",
                  )}
                </div>

                <div className="td2-chatgrid">
                  <label className="td2-chatfield">
                    <span className="td2-chatfield__label">{tx("Nome da build", "Build name")}</span>
                    <input
                      className="td2-input td2-chatfield__input"
                      value={buildName}
                      onChange={(e) => setBuildName(e.target.value)}
                      placeholder={tx("Ex: Striker DPS", "Ex: Striker DPS")}
                    />
                  </label>
                </div>

                <div className="td2-chatpanel__sectionTitle mt-3">{tx("Gear (por slot)", "Gear (by slot)")}</div>
                <div className="td2-chatgrid">
                  {SLOTS.map((slot) => (
                    <label key={slot} className="td2-chatfield">
                      <span className="td2-chatfield__label">{slot}</span>
                      <AsyncCatalogCombo
                        kind="gear"
                        slot={slot}
                        value={gearNames[slot]}
                        onChange={(next) => {
                          setGearNames((v) => ({ ...v, [slot]: next }));
                          setGearPicked((v) => ({ ...v, [slot]: null }));
                        }}
                        onPickId={(id) => setGearPicked((v) => ({ ...v, [slot]: id }))}
                        placeholder={tx("Nome do item", "Item name")}
                        className="td2-input td2-chatfield__input"
                      />
                    </label>
                  ))}
                </div>

                <div className="td2-chatpanel__sectionTitle mt-3">{tx("Armas (opcional)", "Weapons (optional)")}</div>
                <div className="td2-chatgrid">
                  <label className="td2-chatfield">
                    <span className="td2-chatfield__label">{tx("Primária", "Primary")}</span>
                    <AsyncCatalogCombo
                      kind="weapon"
                      value={primaryWeaponName}
                      onChange={(next) => {
                        setPrimaryWeaponName(next);
                        setPrimaryWeaponPicked(null);
                      }}
                      onPickId={(id) => setPrimaryWeaponPicked(id)}
                      placeholder={tx("Nome da arma", "Weapon name")}
                      className="td2-input td2-chatfield__input"
                    />
                  </label>
                  <label className="td2-chatfield">
                    <span className="td2-chatfield__label">{tx("Secundária", "Secondary")}</span>
                    <AsyncCatalogCombo
                      kind="weapon"
                      value={secondaryWeaponName}
                      onChange={(next) => {
                        setSecondaryWeaponName(next);
                        setSecondaryWeaponPicked(null);
                      }}
                      onPickId={(id) => setSecondaryWeaponPicked(id)}
                      placeholder={tx("Nome da arma", "Weapon name")}
                      className="td2-input td2-chatfield__input"
                    />
                  </label>
                </div>

                {error ? <div className="td2-chatpanel__error">{error}</div> : null}

                <div className="td2-chatpanel__actions">
                  <button
                    className="td2-btn td2-chatpanel__btn"
                    onClick={() => {
                      setGearNames(Object.fromEntries(SLOTS.map((s) => [s, ""])));
                      setGearPicked(Object.fromEntries(SLOTS.map((s) => [s, null])));
                      setPrimaryWeaponName("");
                      setSecondaryWeaponName("");
                      setPrimaryWeaponPicked(null);
                      setSecondaryWeaponPicked(null);
                    }}
                    disabled={busy}
                  >
                    {tx("Limpar", "Clear")}
                  </button>
                  <button
                    className="td2-btn td2-chatpanel__btn td2-chatpanel__btn--primary"
                    onClick={onCreateBuildFromNames}
                    disabled={!canSubmit}
                  >
                    {busy ? tx("Criando...", "Creating...") : tx("Criar build", "Create build")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {mode === "chat" ? (
            <div className="td2-chatpanel__composer">
              <input
                ref={inputRef}
                className="td2-input td2-chatpanel__input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSend();
                }}
                placeholder={tx('Ex: "Quero montar uma build"', 'Ex: "I want to create a build"')}
              />
              <button className="td2-btn td2-chatpanel__send" onClick={onSend} disabled={!canSubmit}>
                {tx("Enviar", "Send")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
