import Link from "next/link";
import { Empty } from "@/components/ui";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center justify-center px-6">
      <Empty
        title="This page isn’t here"
        description="The address may have changed. You can return to your workspace to continue."
      >
        <Link href="/dashboard" className={buttonStyles()}>
          Return to overview
        </Link>
      </Empty>
    </main>
  );
}
