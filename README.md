# HAC Swim Booking

Swim lesson booking platform for Heights Athletic Club in Harker Heights, TX. Supports three user roles: parents, instructors, and admins.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Payments:** Stripe Checkout
- **Email:** Resend
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Language:** TypeScript

## Local Development

### Prerequisites

- Node.js 18+
- A Supabase project
- A Stripe account (test mode)
- A Resend account

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Push database schema to Supabase
npx supabase db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Create a `.env.local` file with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Resend (email)
RESEND_API_KEY=re_...
FROM_EMAIL=HAC Swim <noreply@yourdomain.com>

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Cron (optional, for Vercel cron auth)
CRON_SECRET=your-cron-secret
```

## Build & Lint

```bash
npm run build    # Production build
npm run lint     # ESLint
```

## Deployment (Vercel)

1. Connect your GitHub repository to Vercel
2. Set all environment variables above in the Vercel dashboard (use production values)
3. Set `NEXT_PUBLIC_SITE_URL` to your production domain (e.g., `https://hacswim.com`)
4. Deploy

### Post-Deploy Checklist

- **Stripe:** Update webhook endpoint to `https://yourdomain.com/api/stripe/webhook` in the Stripe dashboard
- **Supabase:** Add production URL to Authentication > URL Configuration > Redirect URLs
- **Cron:** The `vercel.json` configures a daily lesson reminder cron at 11 PM UTC. Set `CRON_SECRET` to secure the endpoint
- **DNS:** Configure your custom domain in Vercel settings

## Database Migrations

Migrations are managed via Supabase CLI:

```bash
# Create a new migration
npx supabase migration new your_migration_name

# Apply migrations
npx supabase db push

# Generate TypeScript types (optional)
npx supabase gen types typescript --project-id your-project-id > src/types/database.ts
```

## Project Structure

```
src/
  app/              # Next.js routes (App Router)
    (auth)/         # Login, register
    (public)/       # Landing, events, surveys, legal
    admin/          # Admin dashboard pages
    api/            # API routes (Stripe, cron, notifications)
    dashboard/      # Parent dashboard
    instructor/     # Instructor portal
  components/       # React components
    admin/          # Admin-specific components
    book/           # Class browser & enrollment
    dashboard/      # Parent dashboard components
    events/         # Public events
    instructor/     # Instructor portal components
    landing/        # Landing page sections
    layout/         # Navbar, Footer
    print/          # Print-optimized views
    ui/             # Shared UI primitives (shadcn/ui)
  hooks/            # Custom React hooks
  lib/              # Utilities (Supabase clients, Stripe, email, date formatting)
```
