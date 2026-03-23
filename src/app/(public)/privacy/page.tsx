export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 2026
      </p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
        <p>
          Heights Athletic Club (&ldquo;HAC,&rdquo; &ldquo;we,&rdquo; &ldquo;our&rdquo;) operates
          the HAC Swim Lessons platform at hacswim.com. This Privacy Policy explains how we collect,
          use, protect, and share your personal information when you use our website, mobile
          application, and related services.
        </p>

        <h2>1. Information We Collect</h2>
        <p><strong>Account Information:</strong> Name, email address, phone number, mailing address,
        HAC membership ID (if applicable), and military status.</p>
        <p><strong>Swimmer Information:</strong> Child&rsquo;s name, date of birth, medical notes,
        allergies, special needs, emergency contact details, and swim skill assessments.</p>
        <p><strong>Payment Information:</strong> We do not store credit card numbers. All payment
        processing is handled by Stripe, a PCI DSS Level 1 certified payment processor. We store
        only transaction IDs, amounts, and payment status.</p>
        <p><strong>Usage Data:</strong> We collect standard web analytics including pages visited,
        browser type, device information, and IP address for security and service improvement.</p>
        <p><strong>Communications:</strong> Email correspondence, support requests, and survey
        responses you voluntarily provide.</p>

        <h2>2. How We Use Your Information</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Process swim lesson enrollments and payments</li>
          <li>Communicate class schedules, cancellations, and reminders</li>
          <li>Track swimmer progress and skill development</li>
          <li>Manage waivers and emergency contact information</li>
          <li>Send promotional materials (with your consent; you may opt out at any time)</li>
          <li>Improve our services and website experience</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. Data Protection</h2>
        <p>We implement industry-standard security measures including:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Row-Level Security (RLS):</strong> Database policies ensure users can only
          access their own data. Parents see only their family&rsquo;s swimmers and enrollments;
          instructors see only their assigned classes.</li>
          <li><strong>Encryption:</strong> All data is encrypted in transit (TLS 1.3) and at rest.
          Passwords are hashed using bcrypt.</li>
          <li><strong>PCI Compliance:</strong> Payment processing is handled entirely by Stripe.
          No credit card data touches our servers.</li>
          <li><strong>Access Controls:</strong> Role-based access (parent, instructor, admin) with
          server-side authorization checks on every request.</li>
        </ul>

        <h2>4. Third-Party Services</h2>
        <p>We share limited data with the following service providers, each bound by their own
        privacy policies:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Stripe</strong> — Payment processing. Receives name, email, and payment
          details. <a href="https://stripe.com/privacy" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
          <li><strong>Resend</strong> — Email delivery. Receives recipient email addresses and
          email content. <a href="https://resend.com/legal/privacy-policy" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">Resend Privacy Policy</a></li>
          <li><strong>Supabase</strong> — Database and authentication infrastructure. Data is stored
          in US-based data centers with SOC 2 Type II compliance.</li>
          <li><strong>Vercel</strong> — Website hosting. Processes standard HTTP request data.</li>
        </ul>

        <h2>5. Children&rsquo;s Data</h2>
        <p>Our service involves collecting information about minors (swimmers) as provided by their
        parents or legal guardians. We do not knowingly collect data directly from children.
        All swimmer data is entered and managed by the parent/guardian account holder.</p>
        <p>Parents may review, update, or request deletion of their child&rsquo;s data at any time
        through their dashboard or by contacting us directly.</p>

        <h2>6. Data Retention</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Active accounts:</strong> Data is retained for the life of the account.</li>
          <li><strong>Inactive accounts:</strong> Accounts with no activity for 24 months may be
          flagged for deletion. We will notify you before any action is taken.</li>
          <li><strong>Financial records:</strong> Payment and transaction data is retained for 7
          years as required by tax regulations.</li>
          <li><strong>Waivers:</strong> Signed waivers are retained for the duration of enrollment
          plus 3 years.</li>
          <li><strong>Account deletion:</strong> You may request full account deletion at any time.
          We will remove your data within 30 days, except where retention is legally required.</li>
        </ul>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Access and download your personal data</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your account and data</li>
          <li>Opt out of marketing communications</li>
          <li>Restrict or object to certain processing activities</li>
        </ul>

        <h2>8. Cookies</h2>
        <p>We use essential cookies for authentication and session management. We do not use
        third-party tracking cookies or advertising pixels. Analytics data is collected in
        aggregate form only.</p>

        <h2>9. Changes to This Policy</h2>
        <p>We may update this policy periodically. Material changes will be communicated via email
        to all account holders. Continued use of the service after changes constitutes acceptance.</p>

        <h2>10. Contact Us</h2>
        <p>For privacy-related inquiries, data access requests, or concerns:</p>
        <ul className="list-none space-y-1 pl-0">
          <li><strong>Email:</strong>{" "}
            <a href="mailto:swim@hacswim.com" className="text-accent hover:underline">
              swim@hacswim.com
            </a>
          </li>
          <li><strong>Phone:</strong> (254) 213-5543</li>
          <li><strong>Address:</strong> Heights Athletic Club, 301 E FM 2410 Rd, Harker Heights, TX 76548</li>
        </ul>
      </div>
    </div>
  );
}
