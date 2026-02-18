import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type Role = "user" | "assistant";
type HistoryMsg = { role: Role; text: string };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cleanText(v: string): string {
  return String(v ?? "").replace(/\r/g, "").trim();
}

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    const key = String(this.config.get<string>("GEMINI_API_KEY") ?? "").trim();
    if (!key) throw new ServiceUnavailableException("GEMINI_API_KEY is not configured");
    return key;
  }

  private getModel(): string {
    // Note: Gemini model availability changes over time; keep a recent default.
    const model = String(this.config.get<string>("GEMINI_MODEL") ?? "gemini-2.5-flash").trim();
    return model || "gemini-2.5-flash";
  }

  private buildSystemInstruction(lang?: string): string {
    const l = String(lang ?? "").toLowerCase();
    const inPt = l.startsWith("pt");
    if (inPt) {
      return [
        "Você é um assistente do TD2 Builder (The Division 2).",
        "Ajude a sugerir builds (DPS/Tank/Skill) e responder de forma objetiva.",
        "Quando sugerir itens, cite slots (Mask/Chest/Backpack/Gloves/Holster/Kneepads) e explique o porquê.",
        "Se faltarem dados, pergunte antes de inventar.",
      ].join("\n");
    }
    return [
      "You are an assistant for TD2 Builder (The Division 2).",
      "Suggest builds (DPS/Tank/Skill) and answer concisely.",
      "When suggesting items, mention slots (Mask/Chest/Backpack/Gloves/Holster/Kneepads) and reasoning.",
      "Ask for missing details instead of guessing.",
    ].join("\n");
  }

  async chat(messageRaw: string, history?: HistoryMsg[], lang?: string): Promise<string> {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    const message = cleanText(messageRaw);
    const safeHistory = (history ?? [])
      .slice(-12)
      .map((m) => ({ role: m.role, text: cleanText(m.text) }))
      .filter((m) => m.text && (m.role === "user" || m.role === "assistant"));

    const system = this.buildSystemInstruction(lang);

    const contents = [
      ...safeHistory.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const maxOutputTokens = clamp(Number(this.config.get("GEMINI_MAX_TOKENS") ?? 450), 64, 1500);
    const temperature = clamp(Number(this.config.get("GEMINI_TEMPERATURE") ?? 0.6), 0, 2);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature, maxOutputTokens },
        }),
      });
    } catch {
      // Typical causes: no internet egress, DNS issues, TLS issues.
      throw new ServiceUnavailableException("Failed to reach Gemini API");
    }

    if (!res.ok) {
      const body = (await res.text()).slice(0, 1200);
      throw new BadGatewayException(`Gemini error (${res.status}): ${body || res.statusText}`);
    }

    const data: any = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => String(p?.text ?? "")).join("") ??
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";

    const out = cleanText(String(text ?? ""));
    return out || "Sem resposta do modelo.";
  }
}
