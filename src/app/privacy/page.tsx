import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How WorkCopilot handles activated WhatsApp requests and connected repository data.",
};

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This policy explains how WorkCopilot handles information when the personal WhatsApp AI assistant is used. WorkCopilot is currently configured as a single-owner tool operated by Sandeepa Mallawarachchi, not as a public multi-user service. Questions or privacy requests can be sent to <a href="mailto:sandeepamallawarachchi444@gmail.com">sandeepamallawarachchi444@gmail.com</a>.</p>

      <LegalSection title="Information handled">
        <p>WorkCopilot is designed to store only requests that pass the configured contact allowlist and either begin with the activation prefix (currently <code>@ai</code>) or arrive as a follow-up within the configured follow-up window after a prefixed request (default 10 minutes; the administrator can set it to 0 to always require the prefix). Other messages and messages from unknown or disabled contacts are ignored and are not added to conversation history.</p>
        <LegalList items={[
          "The authorized sender’s WhatsApp phone number and contact settings, such as display name, permission, and preferred language.",
          "Activated request text, the assistant’s reply, timestamps, delivery identifiers, processing status, and relevant source links.",
          "Limited operational records such as tool names, outcomes, retry status, and security or administrator audit events.",
          "Repository content returned by GitHub or GitLab when an activated request calls an enabled, explicitly authorized read-only tool.",
          "Email content from mailboxes the administrator connects (read-only over IMAP), retrieved only when an activated request asks about email. Sign-in and verification emails are never sent to the AI provider; if the administrator enables verification codes, a code or link from an approved sender may be extracted without AI and sent to the requesting authorized contact, and is not kept in conversation history. Mailbox passwords are stored encrypted.",
        ]} />
        <p>Do not send passwords, access tokens, private keys, or other credentials in a WhatsApp request. WorkCopilot does not need them to answer.</p>
      </LegalSection>

      <LegalSection title="How information is used">
        <p>Information is used to authorize contacts, process activated questions, maintain per-contact conversation context, retrieve relevant information from selected repositories, deliver replies, prevent duplicate processing, and troubleshoot service reliability and security.</p>
      </LegalSection>

      <LegalSection title="Service providers and disclosure">
        <p>To provide the assistant, relevant information may be processed by these services according to their own terms and privacy practices:</p>
        <LegalList items={[
          "Meta WhatsApp Cloud API: transports WhatsApp messages and webhook events.",
          "Supabase: hosts the application database, authentication, queues, and backend functions.",
          "Groq: receives an activated request, the limited conversation context needed to generate a reply, and any retrieved repository or email content relevant to it.",
          "GitHub or GitLab: queried only when a request uses an enabled connector; repository access is read-only and limited by the configured repository or project allowlist.",
          "Vercel: hosts the dashboard and public website.",
        ]} />
        <p>Only the information needed for a request should be sent to an AI or repository provider. WorkCopilot does not intentionally send entire repositories or credentials. Service providers may process data in other countries under their applicable terms.</p>
        <p>Information may also be disclosed if required by law or needed to protect the service, its operator, or affected people from abuse or a security incident. WorkCopilot does not sell personal information or use it for advertising.</p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>Activated messages and audit records are subject to the workspace retention setting, which defaults to 30 days and can be changed by the administrator. A scheduled database task removes records past that setting when it is enabled and operating. Some linked job or delivery records may be removed when their related message is deleted. Provider-side records and backups are governed by each provider’s retention policies.</p>
        <p>The administrator can remove conversation history from the dashboard. An authorized contact or other person may request deletion by following the instructions on the <a href="/data-deletion">Data Deletion page</a>. We will verify the request before acting.</p>
      </LegalSection>

      <LegalSection title="Security and access">
        <p>Dashboard access is limited to the authenticated administrator. Database row-level security and server-side credentials protect internal records. Connected repository tools are read-only. No automated repository writes, emails, or deployments are performed.</p>
        <p>No internet service can promise absolute security. Please avoid sending sensitive information and contact us promptly if you believe an account or credential has been exposed.</p>
      </LegalSection>

      <LegalSection title="Your choices and requests">
        <p>The administrator controls contact authorization, AI access, integrations, and retention. You can stop using the assistant at any time. For access, correction, deletion, or privacy questions, email <a href="mailto:sandeepamallawarachchi444@gmail.com">sandeepamallawarachchi444@gmail.com</a> with “WorkCopilot privacy request” in the subject. Do not email passwords or API tokens.</p>
      </LegalSection>

      <LegalSection title="Children and policy changes">
        <p>WorkCopilot is an administrative personal tool and is not designed for children. This policy may be updated as the service changes; the current version and its update date will be posted on this page.</p>
      </LegalSection>
    </LegalPage>
  );
}
