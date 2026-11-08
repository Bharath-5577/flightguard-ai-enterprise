
import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-[#07152f] text-white">
      {/* Navigation */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/welcome" className="flex items-center gap-3">
          <span className="text-3xl">✈</span>
          <span className="text-xl font-bold tracking-wide">
            FlightGuard AI
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/admin/login"
            className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            Admin Login
          </Link>

          <Link
            href="/airline/login"
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold hover:bg-blue-600"
          >
            Airline Login
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-24 text-center">
        <div className="mb-8 inline-block rounded-full border border-blue-400/30 bg-blue-500/10 px-5 py-2 text-xs font-bold tracking-widest text-blue-300">
          ENTERPRISE AVIATION INTELLIGENCE
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
          Smarter Airline Operations.
          <span className="block text-sky-400">
            Powered by AI.
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-slate-300">
          FlightGuard AI helps airline operations teams explore
          flight performance, monitor operational risks, and
          evaluate machine-learning-powered delay predictions
          through a unified intelligence platform.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/airline/register"
            className="rounded-xl bg-blue-500 px-8 py-4 font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-600"
          >
            Register Your Airline →
          </Link>

          <Link
            href="/airline/login"
            className="rounded-xl border border-slate-500 px-8 py-4 font-bold hover:bg-white/10"
          >
            Airline Customer Login
          </Link>
        </div>
      </section>

      {/* Platform capabilities */}
      <section className="border-t border-white/10 bg-[#0b1c3b] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Built for Airline Operations Teams
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: "📊",
                title: "Flight Intelligence",
                description:
                  "Explore historical flight performance, airport trends, and route-level analytics.",
              },
              {
                icon: "🧠",
                title: "AI Delay Predictions",
                description:
                  "Evaluate machine learning models designed to identify potential flight delays.",
              },
              {
                icon: "🛫",
                title: "Operational Monitoring",
                description:
                  "Bring flight observations and operational indicators into one workspace.",
              },
              {
                icon: "🏢",
                title: "Airline Workspaces",
                description:
                  "Provide separate organizational workspaces with controlled access.",
              },
              {
                icon: "🔔",
                title: "Risk Alerts",
                description:
                  "Support operational decision-making with configurable risk notifications.",
              },
              {
                icon: "🛡️",
                title: "Platform Administration",
                description:
                  "Manage airline onboarding, access permissions, and platform activity.",
              },
            ].map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-7"
              >
                <div className="mb-5 text-3xl">
                  {feature.icon}
                </div>

                <h3 className="mb-3 text-xl font-bold">
                  {feature.title}
                </h3>

                <p className="text-sm leading-7 text-slate-300">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Portal selection */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-4 text-center text-3xl font-bold">
          Access FlightGuard AI
        </h2>

        <p className="mb-12 text-center text-slate-300">
          Choose your authorized workspace.
        </p>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-9">
            <div className="mb-5 text-4xl">🛡️</div>

            <h3 className="text-2xl font-bold">
              Platform Administrator
            </h3>

            <p className="mt-4 text-slate-300">
              Manage airline registrations, customer organizations,
              user access, and platform operations.
            </p>

            <Link
              href="/admin/login"
              className="mt-8 inline-block rounded-lg bg-slate-700 px-6 py-3 font-semibold hover:bg-slate-600"
            >
              Admin Login →
            </Link>
          </div>

          <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-9">
            <div className="mb-5 text-4xl">✈️</div>

            <h3 className="text-2xl font-bold">
              Airline Customer
            </h3>

            <p className="mt-4 text-slate-300">
              Access your airline workspace for flight monitoring,
              delay intelligence, and operational analytics.
            </p>

            <Link
              href="/airline/login"
              className="mt-8 inline-block rounded-lg bg-blue-500 px-6 py-3 font-semibold hover:bg-blue-600"
            >
              Airline Login →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-slate-400">
        FlightGuard AI · Enterprise Aviation Intelligence
        <p className="mt-2">
          Research and development prototype.
          Operational predictions require validation.
        </p>
      </footer>
    </main>
  );
}
