import { NavLink } from "react-router";

const NAV_LINKS = [
  { to: "/api", label: "api" },
  { to: "/privacy", label: "privacy" },
  { to: "/about", label: "about" },
];

const Header = () => {
  return (
    <header
      className="mx-auto w-full max-w-3xl border-y"
      style={{
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <NavLink
          to="/"
          className="text-xl"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            color: "var(--color-ink)",
          }}
        >
          lynky
        </NavLink>

        <nav className="flex items-center gap-5">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className="text-xs tracking-widest uppercase transition-colors "
              style={({ isActive }) => ({
                fontFamily: "var(--font-mono)",
                color: isActive ? "var(--color-ink)" : "var(--color-ink-soft)",
              })}
            >
              {link.label}
            </NavLink>
          ))}

        </nav>
      </div>
    </header>
  );
};

export default Header;