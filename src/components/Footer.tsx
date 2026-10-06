import Brand from "./Brand";
import { CONTACT_EMAIL } from "../data/team";

const exploreLinks = [
  { label: "Discover", href: "/store" },
  { label: "Developers", href: "/builders" },
  { label: "Community", href: "/community" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "About", href: "/about" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t-[3px] border-ink bg-purple text-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_.8fr_1fr] lg:px-10">
        <div>
          <Brand light />
          <p className="mt-4 max-w-sm text-sm font-bold leading-6 opacity-90">
            A campus community app store for sharing software, getting thoughtful feedback, and
            finding collaborators across SPECS.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="text-xs font-black uppercase opacity-80">Explore</p>
          <ul className="mt-3 space-y-2">
            {exploreLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm font-black underline-offset-4 hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-xs font-black uppercase opacity-80">Contact</p>
          <p className="mt-3 text-sm font-bold leading-6 opacity-90">
            Suggestions, concerns, or bug reports — we read everything.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-2 inline-block break-all text-sm font-black underline decoration-2 underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
      <div className="border-t-2 border-surface/30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs font-bold opacity-90 sm:px-8 lg:px-10">
          <span>© {new Date().getFullYear()} Specs App Store</span>
          <span>Built together by the SPECS community.</span>
        </div>
      </div>
    </footer>
  );
}
