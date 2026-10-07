import {
  ArrowRight,
  Binoculars,
  CheckCircle,
  RocketLaunch,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react";
import { ButtonLink } from "../components/Button";
import Brand from "../components/Brand";
import Footer from "../components/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen px-5 py-6 pb-0 lg:px-10">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <a href="/landing" aria-label="CodeCanvas landing page">
          <Brand />
        </a>
        <span className="rounded-full border-2 border-ink bg-surface px-3 py-1 text-xs font-black">
          SPECS COMMUNITY
        </span>
      </nav>

      <header className="mx-auto grid max-w-7xl gap-14 py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-24">
        <div>
          <div className="ink-stamp mb-7 bg-surface">
            <Sparkle size={17} weight="fill" />
            SPECS student developer community
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
            Student software, built{" "}
            <span className="sketch-underline text-purple">
              and shared
              <span className="absolute -bottom-2 left-0 -z-10 h-3 w-full -rotate-1 rounded-full bg-yellow" />
            </span>{" "}
            here.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-body">
            A campus community app store for sharing software, getting thoughtful feedback, and
            finding collaborators across the SPECS community.
          </p>
          <div className="mt-9 flex flex-wrap gap-5">
            <ButtonLink href="/signin">
              Sign in to CodeCanvas <RocketLaunch size={21} weight="duotone" />
            </ButtonLink>
            <ButtonLink href="#discover" variant="secondary">
              Explore projects <Binoculars size={21} weight="duotone" />
            </ButtonLink>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-sm font-black">
            {["Student-built software", "Cross-campus collaboration", "Constructive feedback"].map(
              (item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle size={20} weight="fill" className="text-purple" />
                  {item}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="relative">
          <div className="toon-card paper-note rotate-2 rounded-lg bg-sky p-7 pt-10">
            <div className="rounded-[2rem] border-[3px] border-ink bg-surface p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-mint px-3 py-1 text-xs font-black">LIVE</span>
                <RocketLaunch size={40} weight="duotone" />
              </div>
              <div className="mt-12 h-5 w-3/4 rounded-full bg-ink" />
              <div className="mt-3 h-3 w-full rounded-full bg-placeholder" />
              <div className="mt-2 h-3 w-2/3 rounded-full bg-placeholder" />
              <div className="mt-8 grid grid-cols-3 gap-3">
                {["yellow", "pink", "mint"].map((color) => (
                  <div
                    key={color}
                    style={{ backgroundColor: `var(--color-${color})` }}
                    className="h-16 rounded-xl border-[3px] border-ink"
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-7 -left-5 -rotate-6 rounded-2xl border-[3px] border-ink bg-pink p-4 shadow-[4px_4px_0_var(--color-ink)]">
            <UsersThree size={33} weight="duotone" />
          </div>
        </div>
      </header>

      <section id="discover" className="mx-auto max-w-7xl scroll-mt-8 py-14">
        <div className="text-center">
          <p className="text-xs font-black uppercase text-purple">How CodeCanvas works</p>
          <h2 className="mt-3 text-3xl font-black">A shared space for student software.</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              n: "01",
              t: "Sign in",
              d: "Join with your email or Google account to unlock the full community.",
            },
            {
              n: "02",
              t: "Publish a project",
              d: "Give your app a clear home and make it easy for others to try.",
            },
            {
              n: "03",
              t: "Find collaborators",
              d: "Connect with students working on related tools and problems.",
            },
            {
              n: "04",
              t: "Improve through feedback",
              d: "Exchange useful reviews and help promising projects move forward.",
            },
          ].map((item, index) => (
            <article
              key={item.n}
              className={`toon-card paper-note rounded-lg p-6 pt-9 ${index === 0 ? "rotate-[-1deg]" : index === 1 ? "rotate-1" : "rotate-[-.5deg]"}`}
            >
              <span className="text-sm font-black">STEP {item.n}</span>
              <h3 className="mt-8 text-2xl font-black">{item.t}</h3>
              <p className="mt-3 leading-7 text-body">{item.d}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="-mx-5 lg:-mx-10">
        <Footer />
      </div>
    </div>
  );
}
