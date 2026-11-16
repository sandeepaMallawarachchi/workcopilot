import { FaLinkedin } from "react-icons/fa";

/** "Designed and Developed by" credit, shared by every footer. */
export function Credit({ className }: { className?: string }) {
  return (
    <p className={className}>
      Designed and Developed by{" "}
      <a
        href="https://www.linkedin.com/in/sandeepa-mallawarachchi"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded font-semibold text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Sandeepa Mallawarachchi
        <FaLinkedin size={12} color="#0A66C2" aria-hidden="true" />
        <span className="sr-only"> on LinkedIn (opens in a new tab)</span>
      </a>
    </p>
  );
}
