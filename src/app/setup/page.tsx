import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Eyebrow } from "@/components/ui";
import { buttonStyles } from "@/components/ui/button";

const steps = [
  {
    title: "Create your Supabase project",
    description: "Apply the included database migrations.",
  },
  {
    title: "Configure your environment",
    description: "Set the project URL and publishable key in your local environment.",
  },
  {
    title: "Provision your administrator",
    description:
      "Create an Auth user and its authorized profile using the deployment guide.",
  },
];
export default function Setup() {
  return (
    <AuthLayout>
      <Eyebrow>Let’s connect your workspace</Eyebrow>
      <h2 className="text-3xl font-bold tracking-tight text-ink">A secure start.</h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        Connect Supabase to enable administrator sign-in and your live dashboard.
      </p>
      <ol className="my-8 space-y-6">
        {steps.map(({ title, description }, index) => (
          <li key={title} className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-xl border border-accent/10 bg-accent-soft text-xs font-bold text-accent"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-xs leading-6 text-muted">{description}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href="/login" className={buttonStyles({ className: "w-full" })}>
        Continue to sign in <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <p className="mt-5 text-center text-xs leading-6 text-muted">
        Full instructions in <code className="text-[11px]">docs/DEPLOYMENT.md</code>.
      </p>
    </AuthLayout>
  );
}
