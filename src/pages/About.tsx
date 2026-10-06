import { ArrowLeft, EnvelopeSimple, Sparkle } from "@phosphor-icons/react";
import Avatar from "../components/Avatar";
import Brand from "../components/Brand";
import Footer from "../components/Footer";
import { APP_INFO, CONTACT_EMAIL, TEAM } from "../data/team";

export default function About() {

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-6 sm:px-8 lg:px-10">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm font-black underline-offset-4 hover:underline"
        >
          <ArrowLeft size={18} weight="bold" /> Back to home
        </a>
      </div>

      <header className="mx-auto max-w-6xl px-5 pb-4 pt-10 text-center sm:px-8">
        <Brand className="mb-6 inline-flex" />
        <p className="ink-stamp mx-auto bg-surface">About the app</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-black sm:text-5xl">{APP_INFO.name}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg font-bold text-muted">{APP_INFO.tagline}</p>
        <p className="mx-auto mt-5 max-w-3xl leading-8 text-body">{APP_INFO.description}</p>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8" aria-label="Features">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase text-purple">What you can do here</p>
          <h2 className="mt-1 text-2xl font-black">Everything in one place.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {APP_INFO.features.map((f, i) => (
            <article
              key={f.title}
              className={`toon-card paper-note rounded-lg p-6 pt-10 ${i % 3 === 0 ? "rotate-[-1deg]" : i % 3 === 1 ? "rotate-1" : "rotate-[-.5deg]"}`}
            >
              <h3 className="text-xl font-black">{f.title}</h3>
              <p className="mt-2 leading-7 text-body">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8" aria-label="Team">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase text-purple">The builders</p>
          <h2 className="mt-1 text-2xl font-black">Developers of the Specs App Store.</h2>
          <p className="mt-2 font-bold text-muted">
            Edit names, roles, bios, and photos in <code className="rounded bg-ink px-1.5 py-0.5 text-xs text-surface">src/data/team.ts</code>
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((member) => (
            <article key={member.name} className="toon-card rounded-lg bg-surface p-6 text-center">
              <Avatar
                name={member.name}
                color={member.color}
                imageUrl={member.imageUrl}
                size="lg"
              />
              <h3 className="mt-4 text-xl font-black">{member.name}</h3>
              <p className="mt-1 text-sm font-black uppercase text-purple">{member.role}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{member.bio}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8" aria-label="Contact">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase text-purple">Contact</p>
          <h2 className="mt-1 text-2xl font-black">Suggestions, concerns, or bug reports.</h2>
          <p className="mt-2 font-bold text-muted">
            Reach us directly — we read everything.
          </p>
        </div>
        <div className="toon-card paper-note rounded-lg bg-sky p-6 pt-10 text-center sm:p-8 sm:pt-12">
          <EnvelopeSimple size={40} weight="duotone" className="mx-auto text-purple" />
          <p className="mt-4 font-bold text-body">Email us anytime at</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-1 inline-block break-all text-xl font-black text-purple underline decoration-2 underline-offset-4 sm:text-2xl"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      <div className="pointer-events-none flex justify-center" aria-hidden="true">
        <Sparkle size={40} weight="duotone" className="text-pink" />
      </div>

      <Footer />
    </div>
  );
}
