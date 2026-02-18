import { useEffect, useMemo, useState } from "react";
import ComboBox, { type ComboBoxOption } from "./ComboBox";
import { apiGet } from "../api/http";

type GearItemRow = { id: string; name: string };
type WeaponRow = { id: string; name: string };

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

export default function AsyncCatalogCombo(props: {
  kind: "gear" | "weapon";
  slot?: string;
  value: string;
  onChange: (nextLabel: string) => void;
  onPickId?: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  take?: number;
}) {
  const { kind, slot, value, onChange, onPickId, placeholder, disabled, className, take = 12 } = props;

  const debounced = useDebouncedValue(value, 160);
  const [options, setOptions] = useState<ComboBoxOption[]>([]);

  const qs = useMemo(() => {
    const q = String(debounced ?? "").trim();
    const safeTake = Math.max(1, Math.min(50, Math.trunc(take)));
    if (kind === "gear") {
      const slotQ = String(slot ?? "").trim();
      const params = new URLSearchParams();
      if (slotQ) params.set("slot", slotQ);
      params.set("take", String(safeTake));
      if (q) params.set("q", q);
      return `/catalog/gear-items?${params.toString()}`;
    }
    const params = new URLSearchParams();
    params.set("take", String(safeTake));
    if (q) params.set("q", q);
    return `/catalog/weapons?${params.toString()}`;
  }, [debounced, kind, slot, take]);

  useEffect(() => {
    let cancelled = false;
    apiGet<any>(qs)
      .then((res) => {
        if (cancelled) return;
        const items: Array<GearItemRow | WeaponRow> = Array.isArray(res) ? res : (res?.items ?? []);
        const next = (items ?? [])
          .filter((x: any) => x && x.id && x.name)
          .slice(0, take)
          .map((x: any) => ({
            id: String(x.id),
            label: String(x.name),
            keywords: String(x.id),
          }));
        setOptions(next);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [qs, take]);

  return (
    <ComboBox
      value={value}
      onChange={onChange}
      onPick={(opt) => onPickId?.(opt.id)}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      maxItems={8}
      allowCreate={false}
    />
  );
}
