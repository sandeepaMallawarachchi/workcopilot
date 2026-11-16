import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for use of the WorkCopilot personal WhatsApp assistant.",
};

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <p>These terms cover the WorkCopilot personal WhatsApp assistant and its website. WorkCopilot is currently a single-owner tool operated by Sandeepa Mallawarachchi. It is not offered as a multi-tenant SaaS product. By sending an activated request or accessing an authorized account, you agree to these terms. If you do not agree, do not use the service.</p>

      <LegalSection title="Eligibility and authorized use">
        <p>Only contacts explicitly authorized by the administrator may activate the assistant. You agree to use it lawfully and only for repositories or projects you are permitted to access. You are responsible for making sure you have permission to share any request content with the service and its providers.</p>
        <LegalList items={[
          "Do not use the service to request or disclose passwords, API tokens, private keys, or other secrets.",
          "Do not attempt to bypass contact, repository, rate, or tool limits, or interfere with the service’s security.",
          "Do not use answers as a substitute for review of important code, security, legal, financial, or operational decisions.",
        ]} />
      </LegalSection>

      <LegalSection title="AI-generated answers and connected services">
        <p>Answers are generated from the request, limited conversation context, and—when needed—results from explicitly enabled read-only GitHub or GitLab tools. AI output can be incomplete, outdated, or incorrect. Source links and excerpts are provided when available; users should verify important claims against the original source.</p>
        <p>External providers may be unavailable, limit access, change their APIs, or return incomplete information. WorkCopilot does not guarantee uninterrupted operation or that every request will receive a reply.</p>
      </LegalSection>

      <LegalSection title="Read-only limits">
        <p>Repository integrations are configured for reading authorized data. The assistant does not create or modify repository content, send email, or deploy software. You must not rely on it to perform those actions.</p>
      </LegalSection>

      <LegalSection title="Privacy and retention">
        <p>Use of personal information is described in the <a href="/privacy">Privacy Policy</a>. Only explicitly activated messages are intended to be stored. The administrator controls the contact allowlist and retention setting. Deletion instructions are available at <a href="/data-deletion">/data-deletion</a>.</p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>The service is provided as-is for personal use. The operator may suspend access, disable integrations, or change the service to maintain safety, comply with provider requirements, or address technical issues. These terms may be updated; continued use after an update means you accept the revised terms.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about these terms can be sent to <a href="mailto:sandeepamallawarachchi444@gmail.com">sandeepamallawarachchi444@gmail.com</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
