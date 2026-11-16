import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Support",
  description: "Contact WorkCopilot support for account, privacy, and service questions.",
};

export default function Support() {
  return (
    <LegalPage title="Support">
      <p>WorkCopilot is a personal, single-owner WhatsApp assistant. For account access, service questions, privacy requests, or data deletion, contact the operator by email.</p>
      <LegalSection title="Contact the operator">
        <p>Include a short description of the issue and, if relevant, the approximate time it happened. Do not send passwords, access tokens, private keys, or full private repository files.</p>
        <a className={buttonStyles({ className: "mt-2" })} href="mailto:sandeepamallawarachchi444@gmail.com?subject=WorkCopilot%20support">
          <Mail size={16} aria-hidden="true" /> Email support
        </a>
      </LegalSection>
      <LegalSection title="Privacy and deletion">
        <p>Read the <a href="/privacy">Privacy Policy</a> or submit a request through the <a href="/data-deletion">Data Deletion page</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
