export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: April 2026
      </p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
        <p>
          Heights Athletic Club (&ldquo;HAC,&rdquo; &ldquo;we,&rdquo; &ldquo;our&rdquo;) operates
          the HAC Swim staff portal at hacswim.com. This Privacy Policy explains how we collect,
          use, protect, and share personal information when you use our platform.
        </p>

        <h2>1. Information We Collect</h2>
        <p><strong>Staff Account Information:</strong> Name, email address, and role
        (instructor or administrator).</p>
        <p><strong>Swimmer Information:</strong> Name, date of birth, medical notes,
        emergency contact details, swim level, and skill assessments.</p>
        <p><strong>Usage Data:</strong> We collect standard web analytics including pages visited,
        browser type, device information, and IP address for security and service improvement.</p>

        <h2>2. How We Use Your Information</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Manage swim lesson schedules and class assignments</li>
          <li>Communicate class schedules, cancellations, and reminders</li>
          <li>Track swimmer progress and skill development</li>
          <li>Manage emergency contact information</li>
          <li>Improve our services and platform experience</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. Data Protection</h2>
        <p>We implement industry-standard security measures including:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Row-Level Security (RLS):</strong> Database policies ensure users can only
          access data appropriate to their role. Instructors see only their assigned classes;
          administrators have full access.</li>
          <li><strong>Encryption:</strong> All data is encrypted in transit (TLS 1.3) and at rest.
          Passwords are hashed using bcrypt.</li>
          <li><strong>Access Controls:</strong> Role-based access (instructor, admin) with
          server-side authorization checks on every request.</li>
        </ul>

        <h2>4. Third-Party Services</h2>
        <p>We share limited data with the following service providers, each bound by their own
        privacy policies:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Resend</strong> — Email delivery. Receives recipient email addresses and
          email content. <a href="https://resend.com/legal/privacy-policy" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">Resend Privacy Policy</a></li>
          <li><strong>Supabase</strong> — Database and authentication infrastructure. Data is stored
          in US-based data centers with SOC 2 Type II compliance.</li>
          <li><strong>Vercel</strong> — Website hosting. Processes standard HTTP request data.</li>
        </ul>

        <h2>5. Children&rsquo;s Data</h2>
        <p>Our service involves storing information about minors (swimmers) as entered by
        authorized staff members. We do not collect data directly from children.
        All swimmer data is managed by instructors and administrators.</p>

        <h2>6. Data Retention</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Active accounts:</strong> Data is retained for the life of the account.</li>
          <li><strong>Inactive accounts:</strong> Accounts with no activity for 24 months may be
          flagged for deletion. We will notify you before any action is taken.</li>
          <li><strong>Account deletion:</strong> Staff may request account deletion at any time.
          We will remove personal data within 30 days, except where retention is legally required.</li>
        </ul>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Access and download your personal data</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your account and data</li>
          <li>Opt out of email notifications</li>
          <li>Restrict or object to certain processing activities</li>
        </ul>

        <h2>8. Cookies</h2>
        <p>We use essential cookies for authentication and session management. We do not use
        third-party tracking cookies or advertising pixels.</p>

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
