function Feature({ mark, title, body }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-sm"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-dirty)",
        }}
      >
        {mark}
      </span>

      <h3
        className="text-lg"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>

      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-ink-soft)" }}
      >
        {body}
      </p>
    </div>
  );
}

export default Feature