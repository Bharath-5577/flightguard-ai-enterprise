import Link from "next/link";

const tools = [
  {
    title: "2025 Historical Delay Research",
    description:
      "Explore the 2025 flight and weather-based delay research model. Historical analysis only; not a validated live forecast.",
    href: "/airline/predictions/research-2025",
  },

  {
    title: "Flight Cancellation Prediction",
    description: "Research-model cancellation risk estimation.",
    href: "/predictions/cancellation",
  },
  {
    title: "Departure Delay Prediction",
    description: "Research-model departure delay risk estimation.",
    href: "/predictions/delay",
  },
];

export default function AirlinePredictionsPage() {
  return (
    <main className="min-h-screen w-full bg-[#071326] text-white shadow-[0_0_0_100vmax_#071326] clip-path-none mx-auto max-w-6xl px-6 py-12 text-white">
      <p className="text-sm uppercase tracking-widest text-sky-400">
        AI Intelligence
      </p>
      <h1 className="mt-2 text-4xl font-bold">AI Predictions</h1>
      <p className="mt-4 text-slate-300">
        Explore the existing research prediction models.
        These are not verified live airline operational forecasts.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-xl border border-white/10 bg-[#102344] p-7 hover:border-sky-400"
          >
            <h2 className="text-xl font-semibold">{tool.title}</h2>
            <p className="mt-3 text-slate-300">{tool.description}</p>
            <p className="mt-5 text-sky-400">Open Prediction Tool →</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
