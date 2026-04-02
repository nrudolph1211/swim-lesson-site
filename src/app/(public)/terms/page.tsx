export const metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: April 2026
      </p>

      <div className="mt-8 rounded-lg border border-yellow-300 bg-yellow-50 p-6">
        <p className="text-sm font-medium text-yellow-800">
          These Terms of Service are currently under legal review and will be finalized prior
          to the official launch of the HAC Swim platform.
        </p>
        <p className="mt-2 text-sm text-yellow-700">
          By using this platform during the preview period, you acknowledge that these terms
          are subject to change. Final terms will be communicated to all staff members
          via email before they take effect.
        </p>
      </div>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
        <h2>1. Overview</h2>
        <p>
          Heights Athletic Club (&ldquo;HAC&rdquo;) provides a staff portal for managing
          swim lessons at our Harker Heights, Texas facility. These Terms of Service
          govern your use of hacswim.com and related services.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          This platform is for authorized staff members only, including swim instructors
          and administrators. By using this platform, you represent that you are an
          authorized employee or contractor of Heights Athletic Club.
        </p>

        <h2>3. Data Handling</h2>
        <p>
          Staff members handle sensitive information including swimmer personal data,
          emergency contacts, and medical notes. You agree to handle all data in accordance
          with our Privacy Policy and applicable data protection regulations.
        </p>

        <h2>4. Code of Conduct</h2>
        <p>
          Staff members are expected to use the platform professionally, maintain accurate
          records, and protect the confidentiality of swimmer and family information.
          HAC reserves the right to revoke platform access for any violations.
        </p>

        <h2>5. Cancellations</h2>
        <p>
          Weather cancellations and schedule changes should be recorded in the platform
          promptly to ensure accurate records and timely notifications.
        </p>

        <h2>6. Contact</h2>
        <p>
          Questions about these terms may be directed to{" "}
          <a href="mailto:swim@hacswim.com" className="text-accent hover:underline">
            swim@hacswim.com
          </a>{" "}
          or (254) 213-5543.
        </p>
      </div>
    </div>
  );
}
