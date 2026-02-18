import { useEffect, useMemo, useRef, useState } from "react";

export type ComboBoxOption = {
  id: string;
  label: string;
  keywords?: string;
};

export default function ComboBox(props: {
  value: string;
  onChange: (next: string) => void;
  onPick?: (opt: ComboBoxOption) => void;
  options: ComboBoxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxItems?: number;
  allowCreate?: boolean;
  createLabel?: (q: string) => string;
  onCreate?: (q: string) => void;
}) {
  const {
    value,
    onChange,
    onPick,
    options,
    placeholder,
    disabled,
    className,
    maxItems = 8,
    allowCreate = false,
    createLabel,
    onCreate,
  } = props;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return options.slice(0, maxItems);
    const scored = options
      .map((o) => {
        const hay = `${o.label} ${(o.keywords ?? "")}`.toLowerCase();
        const idx = hay.indexOf(q);
        return { o, idx };
      })
      .filter((x) => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx || a.o.label.localeCompare(b.o.label))
      .slice(0, maxItems)
      .map((x) => x.o);
    return scored;
  }, [options, q, maxItems]);

  const exactMatch = useMemo(() => {
    const v = value.trim().toLowerCase();
    if (!v) return null;
    return options.find((o) => o.label.toLowerCase() === v) ?? null;
  }, [options, value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (opt: ComboBoxOption) => {
    onChange(opt.label);
    onPick?.(opt);
    setOpen(false);
    setActive(0);
    queueMicrotask(() => inputRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((x) => Math.min(x + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((x) => Math.max(0, x - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = filtered[active];
      if (picked) return choose(picked);
      if (allowCreate && value.trim() && !exactMatch) onCreate?.(value.trim());
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
          // Defensive: keep typing uninterrupted even if a newly-rendered element would steal focus.
          queueMicrotask(() => inputRef.current?.focus());
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
        spellCheck={false}
      />

      {open && !disabled ? (
        <div className="td2-combobox">
          {filtered.length ? (
            <div className="td2-combobox__list">
              {filtered.map((o, idx) => (
                <button
                  key={o.id}
                  type="button"
                  className={`td2-combobox__item ${idx === active ? "td2-combobox__item--active" : ""}`}
                  onMouseDown={(e) => {
                    // Prevent input blur when clicking an option.
                    e.preventDefault();
                  }}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => choose(o)}
                >
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="td2-combobox__empty">No results</div>
          )}

          {allowCreate && value.trim() && !exactMatch ? (
            <button
              type="button"
              className="td2-combobox__create"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onCreate?.(value.trim());
                setOpen(false);
              }}
            >
              {createLabel ? createLabel(value.trim()) : `Create "${value.trim()}"`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
