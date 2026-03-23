export const metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 2026
      </p>

      <div className="mt-8 rounded-lg border border-yellow-300 bg-yellow-50 p-6">
        <p className="text-sm font-medium text-yellow-800">
          These Terms of Service are currently under legal review and will be finalized prior
          to the official launch of the HAC Swim platform.
        </p>
        <p className="mt-2 text-sm text-yellow-700">
          By using this platform during the preview period, you acknowledge that these terms
          are subject to change. Final terms will be communicated to all registered users
          via email before they take effect.
        </p>
      </div>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
        <h2>1. Overview</h2>
        <p>
          Heights Athletic Club (&ldquo;HAC&rdquo;) provides an online platform for booking
          and managing swim lessons at our Harker Heights, Texas facility. These Terms of Service
          govern your use of hacswim.com and related services.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old and a legal parent or guardian of any swimmer you
          register. By creating an account, you represent that the information provided is
          accurate and complete.
        </p>

        <h2>3. Enrollment &amp; Payment</h2>
        <p>
          Enrollment is confirmed upon successful payment. Prices are displayed at the time
          of enrollment and may vary by session, membership status, and class type. All payments
          are processed securely through Stripe.
        </p>

        <h2>4. Cancellation &amp; Refund Policy</h2>
        <p>
          Full refunds are available if you cancel before the session starts. After the session
          begins, cancellations result in a prorated credit applied to your account. Weather
          cancellations by HAC result in automatic makeup credits.
        </p>

        <h2>5. Liability Waiver</h2>
        <p>
          A signed liability waiver is required for each swimmer before participating in any
          class. The waiver covers assumption of risk, release of liability, and indemnification
          as detailed in the waiver document presented during registration.
        </p>

        <h2>6. Code of Conduct</h2>
        <p>
          Parents and swimmers are expected to follow all pool rules, arrive on time, and treat
          instructors and staff with respect. HAC reserves the right to remove any participant
          whose behavior poses a safety risk to themselves or others.
        </p>

        <h2>7. Contact</h2>
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
