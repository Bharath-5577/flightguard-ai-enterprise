import Link from "next/link";

const features = [
  ["Flight Management", "Manage airline-owned operational flights."],
  ["AI Predictions", "Explore research-based flight predictions."],
  ["Analytics & Results", "Analyze aviation performance and trends."],
  ["Reports", "Access and export operational reports."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#071326] text-white">
      <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <p className="font-bold uppercase tracking-[0.2em] text-cyan-400">
          FlightGuard AI Enterprise
        </p>

        <h1 className="mt-7 max-w-4xl text-5xl font-extrabold leading-tight md:text-7xl">
          Smarter Aviation.
          <span className="block text-cyan-400">
            Powered by Intelligence.
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-lg text-slate-300">
          One intelligent platform for airline operations,
          flight analytics, predictive research and reporting.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/airline/login"
            className="rounded-xl bg-cyan-500 px-7 py-4 font-bold text-slate-950">
            Customer Login
          </Link>
          <Link href="/airline/register"
            className="rounded-xl border border-cyan-400 px-7 py-4 font-bold">
            Register Airline
          </Link>
          <Link href="/admin/login"
            className="rounded-xl border border-white/30 px-7 py-4 font-bold">
            Admin Login
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <h2 className="mb-8 text-3xl font-bold">
          Enterprise Aviation Solutions
        </h2>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map(([title, description]) => (
            <article key={title}
              className="rounded-2xl border border-white/10 bg-[#102344] p-7">
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="mt-4 text-slate-300">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 p-8 text-center text-slate-400">
        FlightGuard AI Enterprise
      </footer>
    </main>
  );
}
