import React from "react";

const Header = () => {
  return (
    <header
      className="mx-auto w-full max-w-3xl border-y"
      style={{
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex w-full items-center justify-between px-6 py-6 sm:px-8">
        <span
          className="text-xl"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
          }}
        >
          lynky
        </span>

        <span
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-soft)",
          }}
        >
          coming soon
        </span>
      </div>
    </header>
  );
};

export default Header; 