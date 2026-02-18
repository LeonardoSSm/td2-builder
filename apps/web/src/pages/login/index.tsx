import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import { useI18n } from "../../i18n";

function normalizeEmail(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u002e\u2024\u3002\uFF0E]+$/g, "")
    .replace(/[.,;:]+$/g, "");
}

export default function LoginPage() {
  const { tx } = useI18n();
  const nav = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("root@local.test");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (ex: any) {
      setErr(ex?.message ?? String(ex));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="td2-page td2-page--center">
      <div className="td2-card rounded-2xl p-6 max-w-md">
        <div className="td2-heading text-lg font-semibold">{tx("Entrar", "Sign in")}</div>
        <div className="text-xs td2-subheading mt-1">
          {tx("Use seu email e senha para acessar o admin.", "Use your email and password to access admin.")}
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmail((v) => normalizeEmail(v))}
            placeholder="email"
            className="td2-input w-full px-3 py-2 text-sm"
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tx("senha", "password")}
            className="td2-input w-full px-3 py-2 text-sm"
            autoComplete="current-password"
          />

          {err ? <div className="text-xs text-red-300">{err}</div> : null}

          <button className="td2-btn w-full px-4 py-2 text-sm" disabled={loading}>
            {loading ? tx("Entrando...", "Signing in...") : tx("Entrar", "Sign in")}
          </button>
        </form>
      </div>
    </div>
  );
}
