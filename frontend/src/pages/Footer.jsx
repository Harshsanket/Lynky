import React from "react";

const Footer = () => {
  return (
    <footer
      className="mx-auto w-full max-w-3xl border-y"
      style={{
        borderColor: "var(--color-border)",
        color: "var(--color-ink-soft)",
      }}
    >
      <div className="flex w-full items-center justify-between px-6 py-6 sm:px-8">
        <span
          className="text-sm"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          lynky — a{" "}
          <b style={{ color: "var(--color-ink)" }}>
            <a href="https://github.com/Harshsanket">Harsh Sanket</a>
          </b>{" "}
          productions
        </span>

        <span
          className="text-sm"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          © {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
};

export default Footer;