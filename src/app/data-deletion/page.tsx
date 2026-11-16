import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "User Data Deletion",
  description: "How to request deletion of data handled by WorkCopilot.",
};

export default function DataDeletion() {
  return (
    <LegalPage title="User Data Deletion">
      <p>WorkCopilot stores only messages that are explicitly activated by an authorized contact, plus follow-ups sent within the configured follow-up window after an activated message. Ordinary WhatsApp conversations are not intentionally stored as agent history.</p>

      <LegalSection title="Request deletion">
        <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-accent">
          <li>Email <a href="mailto:sandeepamallawarachchi444@gmail.com?subject=WorkCopilot%20data%20deletion%20request">sandeepamallawarachchi444@gmail.com</a> with the subject “WorkCopilot data deletion request.”</li>
          <li>Include the WhatsApp phone number in international format that was used with the assistant, and identify whether you are asking to remove conversation history, contact details, or both.</li>
          <li>Do not include passwords, API keys, private keys, or other credentials in the request.</li>
          <li>We may ask for reasonable verification that you control the number or represent the person concerned before processing the request.</li>
        </ol>
      </LegalSection>

      <LegalSection title="What happens next">
        <p>After verification, the administrator will remove the relevant contact and/or conversation records from the WorkCopilot database. Message and audit records are also subject to the configured retention period, which defaults to 30 days. Provider logs, backups, and records held by Meta, Supabase, Groq, GitHub, GitLab, or Vercel are controlled by those providers’ own deletion and retention processes; a request to WorkCopilot does not automatically delete data held independently by those providers.</p>
        <p>We will respond to the request at the email address used to contact us. If you need to delete information held by WhatsApp or another provider, use that provider’s own account and privacy controls as well.</p>
      </LegalSection>
    </LegalPage>
  );
}
