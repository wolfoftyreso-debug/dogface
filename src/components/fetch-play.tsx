type FetchPlayProps = {
  mode: "fetch" | "eat";
};

export function FetchPlay({ mode }: FetchPlayProps) {
  return (
    <div
      className={mode === "eat" ? "play-stage is-eat" : "play-stage is-fetch"}
      role="img"
      aria-label={mode === "eat" ? "The dog jumps on the person" : "A person throwing a stick for a dog"}
    >
      <div className="play-ground" />
      <div className="play-person">
        <span className="play-head" />
        <span className="play-torso" />
        <span className="play-arm" />
        <span className="play-leg" />
        <span className="play-leg is-back" />
      </div>
      <div className="play-stick" />
      <div className="play-dog">
        <span className="play-ear" />
        <span className="play-ear is-back" />
        <span className="play-body" />
        <span className="play-snout" />
        <span className="play-eye" />
        <span className="play-tail" />
      </div>
    </div>
  );
}
