import { useRef, useState } from "react";
import { generateDogTwin, getGeneration } from "@/lib/generate";
import { savePhoto } from "@/lib/save-photo";
import {
  DNA_PRESETS,
  STUDIO_EFFECTS,
  cacheKey,
  clampStrength,
  shouldSpendCredit,
  type StudioEffectId,
  type StudioRenderMode,
} from "@/lib/studio";
import { ERROR_MESSAGES, type HistoryItem } from "@/lib/types";

const WAIT_MS = 240_000;

type Props = {
  item: HistoryItem;
  sourceUrl: string | null;
  onClose: () => void;
  onRemaining: (remaining: number) => void;
};

type Frame = {
  effect: StudioEffectId;
  strength: number;
  split: number;
};

function effectOf(id: StudioEffectId) {
  return STUDIO_EFFECTS.find((effect) => effect.id === id) ?? STUDIO_EFFECTS[0]!;
}

export function StudioEditor({ item, sourceUrl, onClose, onRemaining }: Props) {
  const resultUrl = item.splitDataUrl || item.imageDataUrl;
  const fullDogUrl = item.dogDataUrl && item.dogDataUrl !== resultUrl ? item.dogDataUrl : null;
  const [frame, setFrame] = useState<Frame>({ effect: "dog-dna", strength: 100, split: 50 });
  const [past, setPast] = useState<Frame[]>([]);
  const [future, setFuture] = useState<Frame[]>([]);
  const [renders, setRenders] = useState<Record<string, string>>({});
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const drag = useRef(false);

  function commit(next: Frame) {
    setPast((items) => [...items, frame].slice(-30));
    setFuture([]);
    setFrame(next);
    setNote(null);
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [frame, ...items]);
    setFrame(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, frame].slice(-30));
    setFrame(next);
  }

  const rendered =
    frame.effect === "full-dog"
      ? renders[cacheKey("full-dog", 100)] || fullDogUrl
      : frame.effect === "dog-dna"
        ? renders[cacheKey("dog-dna", frame.strength)]
        : null;

  const showOriginal = holding || frame.effect === "original" || (frame.effect === "dog-dna" && frame.strength === 0);
  const compare = frame.effect === "compare-v" || frame.effect === "compare-h";
  const approximate =
    frame.effect === "dog-dna" && frame.strength > 0 && frame.strength < 100 && !rendered && !holding;
  const human = sourceUrl;
  const baseDog = resultUrl;

  let view = resultUrl;
  if (showOriginal && human) view = human;
  else if (frame.effect === "full-dog" && rendered) view = rendered;
  else if (frame.effect === "dog-dna" && frame.strength === 100) view = resultUrl;
  else if (rendered) view = rendered;
  else if (frame.effect === "hybrid") view = resultUrl;

  const effect = effectOf(frame.effect);
  const canCompare = Boolean(human);

  async function renderFinal(mode: StudioRenderMode, strength: number) {
    if (!shouldSpendCredit("render") || !human || busy) return;
    const agreed = window.confirm("Render this with AI? It uses 1 photo credit. A failed render does not.");
    if (!agreed) return;
    setBusy(true);
    setNote("Rendering…");
    const requestId = crypto.randomUUID();
    try {
      let response = await generateDogTwin({
        data: { image: human, requestId, style: "dog", studio: { mode, strength } },
      });
      const jobId = response.ok ? response.id : requestId;
      if (!response.ok || response.status !== "ready") {
        const deadline = Date.now() + WAIT_MS;
        while (Date.now() < deadline) {
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
          response = await getGeneration({ data: { id: jobId } });
          if (!response.ok || response.status === "ready") break;
        }
      }
      if (!response.ok) {
        setNote(response.message);
        if (typeof response.remaining === "number") onRemaining(response.remaining);
        return;
      }
      if (response.status !== "ready") {
        setNote(ERROR_MESSAGES.timeout);
        return;
      }
      onRemaining(response.remaining);
      const url = response.dogDataUrl || response.imageDataUrl;
      setRenders((current) => ({ ...current, [cacheKey(mode, strength)]: url }));
      setNote("Final render");
    } catch {
      setNote(ERROR_MESSAGES.failed);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const result = await savePhoto(view, `${(item.breed || "dog").replace(/\s+/g, "-")}.jpg`);
      if (!result.ok) {
        setNote(result.aborted ? null : "Couldn’t save.");
        return;
      }
      setNote(result.mode === "press" ? "Press and hold the photo, then tap Save Image." : "Saved.");
    } catch {
      setNote("Couldn’t save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="studio" role="dialog" aria-label="Studio" aria-modal="true">
      <header className="studio-bar">
        <button type="button" onClick={onClose}>
          Back
        </button>
        <div className="studio-bar-actions">
          <button type="button" onClick={undo} disabled={!past.length}>
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!future.length}>
            Redo
          </button>
          <button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div
        className="studio-stage"
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
      >
        {compare && canCompare ? (
          <Compare human={human!} dog={baseDog} axis={frame.effect === "compare-h" ? "h" : "v"} split={frame.split} />
        ) : approximate && human ? (
          <div className="studio-compare" aria-hidden="true">
            <img src={human} alt="" />
            <img src={baseDog} alt="" style={{ opacity: frame.strength / 100 }} />
          </div>
        ) : (
          <img src={view} alt="" />
        )}
        {approximate ? <p className="studio-badge">Approximate preview. Not a final render.</p> : null}
        {holding ? <p className="studio-badge">Before</p> : null}
        {compare ? (
          <input
            className={frame.effect === "compare-h" ? "studio-split is-h" : "studio-split"}
            type="range"
            min={5}
            max={95}
            value={frame.split}
            aria-label={frame.effect === "compare-h" ? "Horizontal split" : "Vertical split"}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => setFrame({ ...frame, split: Number(event.target.value) })}
          />
        ) : null}
      </div>

      <div className="studio-dock">
        <div className="studio-effects" role="listbox" aria-label="Effects">
          {STUDIO_EFFECTS.map((itemEffect) => (
            <button
              type="button"
              key={itemEffect.id}
              role="option"
              aria-selected={frame.effect === itemEffect.id}
              disabled={!itemEffect.enabled || ((itemEffect.id === "compare-v" || itemEffect.id === "compare-h" || itemEffect.id === "original") && !human)}
              className={frame.effect === itemEffect.id ? "is-on" : undefined}
              onClick={() => {
                if (!itemEffect.enabled) return;
                commit({ ...frame, effect: itemEffect.id });
              }}
            >
              <span>{itemEffect.label}</span>
              {!itemEffect.enabled ? <small>Soon</small> : null}
            </button>
          ))}
        </div>
        <p className="studio-hint">{effect.hint}</p>
        {frame.effect === "dog-dna" ? (
          <>
            <div className="studio-strength">
              <input
                type="range"
                min={0}
                max={100}
                value={frame.strength}
                aria-valuetext={`${frame.strength}%`}
                aria-label="Dog DNA strength"
                onPointerDown={() => {
                  drag.current = true;
                }}
                onPointerUp={() => {
                  drag.current = false;
                }}
                onChange={(event) => {
                  const strength = clampStrength(Number(event.target.value));
                  setFrame({ ...frame, strength });
                  if (shouldSpendCredit("slide")) return;
                }}
              />
              <strong>{frame.strength}%</strong>
            </div>
            <div className="studio-presets">
              {DNA_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={frame.strength === preset ? "is-on" : undefined}
                  onClick={() => {
                    commit({ ...frame, strength: preset });
                    navigator.vibrate?.(8);
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
            {frame.strength > 0 && frame.strength < 100 && !renders[cacheKey("dog-dna", frame.strength)] ? (
              <button
                type="button"
                className="studio-render"
                disabled={busy || !human}
                onClick={() => void renderFinal("dog-dna", frame.strength)}
              >
                {busy ? "Rendering…" : `Render ${frame.strength}% · uses 1 photo`}
              </button>
            ) : null}
          </>
        ) : null}
        {frame.effect === "full-dog" && !rendered ? (
          <button type="button" className="studio-render" disabled={busy || !human} onClick={() => void renderFinal("full-dog", 100)}>
            {busy ? "Rendering…" : "Render full dog · uses 1 photo"}
          </button>
        ) : null}
        {!human && frame.effect !== "hybrid" ? (
          <p className="studio-hint">The original photo isn’t on this phone, so compare and new renders need a new photo.</p>
        ) : null}
        {note ? <p className="studio-hint">{note}</p> : null}
      </div>
    </div>
  );
}

function Compare({
  human,
  dog,
  axis,
  split,
}: {
  human: string;
  dog: string;
  axis: "h" | "v";
  split: number;
}) {
  const clip = axis === "h" ? `inset(0 0 ${100 - split}% 0)` : `inset(0 ${100 - split}% 0 0)`;
  return (
    <div className="studio-compare">
      <img src={dog} alt="" />
      <img src={human} alt="" style={{ clipPath: clip }} />
    </div>
  );
}
