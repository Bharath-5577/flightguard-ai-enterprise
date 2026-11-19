import Link from "next/link";

export default function AdminAirlinesPage() {
  return (
    <main className="fg-admin-page"><div className="mx-auto max-w-6xl space-y-8 px-6">
      <h1 className="text-4xl font-bold">Airline Management</h1>
      <p className="text-slate-300">
        Manage airline onboarding through the existing
        administrator approval workflow.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/admin/registrations"
          className="rounded-xl border border-white/10 bg-[#102344] p-8 hover:border-sky-400"
        >
          <h2 className="text-xl font-semibold">Customer Registrations</h2>
          <p className="mt-3 text-slate-300">
            Review and approve or reject airline registrations.
          </p>
          <p className="mt-5 text-sky-400">Open Approvals →</p>
        </Link>

        <Link
          href="/admin"
          className="rounded-xl border border-white/10 bg-[#102344] p-8 hover:border-sky-400"
        >
          <h2 className="text-xl font-semibold">Platform Dashboard</h2>
          <p className="mt-3 text-slate-300">
            Return to the existing administrator dashboard.
          </p>
          <p className="mt-5 text-sky-400">Open Dashboard →</p>
        </Link>
      </div>
    </div>
</main>
  );
}
