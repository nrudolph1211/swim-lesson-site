import Link from "next/link";
import type { Metadata } from "next";
import {
  Waves,
  UserPlus,
  Baby,
  CalendarCheck,
  Droplets,
  Users,
  Award,
  BarChart3,
  Heart,
  Clock,
  Shield,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { TestimonialsCarousel } from "@/components/landing/TestimonialsCarousel";
import { InstructorBios } from "@/components/landing/InstructorBios";

export const metadata: Metadata = {
  title: "Heights Athletic Club — Swim Lessons",
  description:
    "Book swim lessons at Heights Athletic Club in Harker Heights, TX. Progressive 5-level curriculum for ages 3+. Member, military, and family pricing available.",
  openGraph: {
    title: "Heights Athletic Club — Swim Lessons",
    description:
      "Expert swim instruction for ages 3+ in Harker Heights, TX. Small classes, certified instructors, and real progress tracking.",
    type: "website",
  },
};

const levels = [
  {
    num: 1,
    name: "Water Introduction",
    color: "#2980B9",
    ages: "Ages 3–5",
    duration: "30 min",
    maxStudents: 4,
    skills: [
      "Enter water willingly",
      "Blow bubbles & submerge face",
      "Assisted front & back float",
      "Kick with support",
    ],
  },
  {
    num: 2,
    name: "Beginner",
    color: "#219A52",
    ages: "Ages 4–7",
    duration: "30 min",
    maxStudents: 5,
    skills: [
      "Unassisted front & back float",
      "Glide with kick (5 yards)",
      "Roll front to back",
      "Jump in from side",
    ],
  },
  {
    num: 3,
    name: "Intermediate",
    color: "#F1C40F",
    ages: "Ages 5–9",
    duration: "30 min",
    maxStudents: 6,
    skills: [
      "Freestyle arms with breathing",
      "Backstroke kick with arms",
      "Tread water 30 seconds",
      "Swim 15 yards continuously",
    ],
  },
  {
    num: 4,
    name: "Advanced",
    color: "#D35400",
    ages: "Ages 6–12",
    duration: "45 min",
    maxStudents: 6,
    skills: [
      "Freestyle 25 yards with breathing",
      "Backstroke full stroke",
      "Breaststroke & butterfly kick",
      "Tread water 1 minute",
    ],
  },
  {
    num: 5,
    name: "Pre-Competitive",
    color: "#C0392B",
    ages: "Ages 7+",
    duration: "45 min",
    maxStudents: 8,
    skills: [
      "All four strokes with flip turns",
      "Individual medley",
      "Racing dive from blocks",
      "Swim 100 yards continuously",
    ],
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Create Account",
    desc: "Sign up in seconds with your email — no membership required to enroll.",
  },
  {
    icon: Baby,
    title: "Add Your Swimmer",
    desc: "Enter your child's info and we'll recommend the right level to start.",
  },
  {
    icon: CalendarCheck,
    title: "Choose a Class",
    desc: "Pick the days, times, and session that work best for your family.",
  },
  {
    icon: Droplets,
    title: "Start Swimming!",
    desc: "Show up, sign the waiver, and watch your swimmer grow each week.",
  },
];

const whyCards = [
  {
    icon: Users,
    title: "Small Class Sizes",
    desc: "4–8 swimmers per class so every child gets individual attention and feedback.",
  },
  {
    icon: Award,
    title: "Certified Instructors",
    desc: "Every instructor is lifeguard-certified with specialized swim lesson training.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    desc: "Real-time skill checklists so you can see exactly what your child has mastered.",
  },
  {
    icon: Heart,
    title: "Member Benefits",
    desc: "HAC members enjoy discounted rates, priority enrollment, and early bird pricing.",
  },
  {
    icon: Clock,
    title: "Flexible Scheduling",
    desc: "Multiple days and times each session, plus makeup credits for missed lessons.",
  },
  {
    icon: Shield,
    title: "Military Friendly",
    desc: "Special pricing for active duty and dependents stationed at Fort Cavazos.",
  },
];

const faqs = [
  {
    q: "What ages do you accept?",
    a: "We accept swimmers ages 3 and up. Children must be at least 3 years old by the first day of the session. There is no upper age limit — we welcome teens and adults too.",
  },
  {
    q: "How do you determine my child's level?",
    a: "New swimmers start at Level 1 unless a parent indicates prior experience. During the first class, the instructor will assess your child and recommend the appropriate level. You can also request a free skill assessment before enrolling.",
  },
  {
    q: "What should my child bring to class?",
    a: "A swimsuit, towel, and goggles (optional). We recommend swim diapers for children not yet potty-trained. No flotation devices are allowed during instruction. Sunscreen should be applied at least 15 minutes before class.",
  },
  {
    q: "What is the cancellation and makeup policy?",
    a: "You can cancel with a full refund up to 24 hours before the session starts. After the session begins, you'll receive makeup credits for missed classes (up to 2 per session). Makeup credits must be used within the current session.",
  },
  {
    q: "Do I need to be an HAC member?",
    a: "No! Swim lessons are open to the entire community. HAC members receive discounted rates and priority enrollment windows, but everyone is welcome to register at our standard pricing.",
  },
  {
    q: "What certifications do instructors have?",
    a: "All instructors hold current lifeguard certification (American Red Cross or equivalent), CPR/First Aid certification, and have completed our in-house Swim Instructor Training Program. Many also hold Water Safety Instructor (WSI) certification.",
  },
  {
    q: "What happens if there's bad weather?",
    a: "If the pool must close due to lightning, severe weather, or unsafe conditions, all families in affected classes will receive an automatic notification and a makeup credit. We follow a strict lightning safety protocol with a 30-minute clear rule.",
  },
  {
    q: "How do I track my child's progress?",
    a: "Log into your parent dashboard to view your child's skill checklist in real time. Instructors update skills after each class. You'll also receive end-of-session reports with instructor notes and level-up recommendations.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: "Heights Athletic Club — Swim Lessons",
  description:
    "Progressive swim lesson program with 5 levels for ages 3 and up at Heights Athletic Club in Harker Heights, Texas.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "301 E FM 2410 Rd",
    addressLocality: "Harker Heights",
    addressRegion: "TX",
    postalCode: "76548",
    addressCountry: "US",
  },
  telephone: "+1-254-213-5543",
  url: "https://hacswim.com",
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/95 to-accent text-white">
        <div className="mx-auto max-w-7xl px-4 pb-32 pt-20 sm:px-6 sm:pb-36 sm:pt-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="secondary"
              className="mb-6 border-white/20 bg-white/10 text-white"
            >
              Heights Athletic Club — Harker Heights, TX
            </Badge>

            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Swim Lessons at Heights Athletic Club
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">
              Expert instruction for ages 3 and up in a safe, supportive
              environment at Harker Heights&apos; premier athletic club.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/book">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90"
                >
                  Browse Classes
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </Link>
              <a href="#curriculum">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Learn About Our Program
                </Button>
              </a>
            </div>

            <p className="mt-10 text-sm text-white/60">
              Proudly serving the Harker Heights &amp; Fort Cavazos community
            </p>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute inset-x-0 -bottom-px">
          <svg
            viewBox="0 0 1440 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z"
              fill="var(--background)"
            />
          </svg>
        </div>
      </section>

      {/* ── CURRICULUM ── */}
      <section id="curriculum" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              A Progressive 5-Level Curriculum
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Each level builds on the last, taking swimmers from first splashes
              to competitive readiness.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {levels.map((level) => (
              <Card
                key={level.num}
                className="relative overflow-hidden border-t-4 transition-shadow hover:shadow-lg"
                style={{ borderTopColor: level.color }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: level.color }}
                    >
                      {level.num}
                    </span>
                    <div>
                      <p className="font-heading text-sm font-semibold leading-tight">
                        {level.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {level.ages}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <ul className="space-y-1.5">
                    {level.skills.map((skill) => (
                      <li
                        key={skill}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <Check
                          className="mt-0.5 size-3 shrink-0"
                          style={{ color: level.color }}
                        />
                        {skill}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
                    <span>{level.duration} classes</span>
                    <span>Max {level.maxStudents} students</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="border-y bg-muted/40 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted-foreground">
            From sign-up to splash — it only takes a few minutes.
          </p>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative text-center">
                  {i < steps.length - 1 && (
                    <div className="absolute left-1/2 top-7 hidden h-px w-full bg-border lg:block" />
                  )}
                  <div className="relative mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow-md">
                    <Icon className="size-6" />
                    <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-heading text-base font-semibold">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── WHY HAC ── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">
            Why Heights Athletic Club?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted-foreground">
            Everything your family needs for a great swim lesson experience.
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {whyCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.title}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-semibold">
                        {card.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {card.desc}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── INSTRUCTORS ── */}
      <InstructorBios />

      {/* ── TESTIMONIALS ── */}
      <TestimonialsCarousel />

      {/* ── PRICING ── */}
      <section className="border-y bg-muted/40 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted-foreground">
            Session-based pricing with small class sizes and expert instruction.
          </p>

          <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-3">
            {/* Group Lessons */}
            <Card className="relative overflow-hidden border-primary/30 transition-shadow hover:shadow-lg">
              <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
              <CardContent className="p-6 text-center">
                <Badge variant="secondary" className="mb-3">
                  Group Lessons
                </Badge>
                <div className="mt-2">
                  <span className="font-heading text-4xl font-bold">$120</span>
                  <span className="text-muted-foreground"> – $160</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  per session (8 lessons)
                </p>
                <ul className="mt-5 space-y-2 text-left text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    Small classes (4–6 students max)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    Ages 6 months through adult
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    25–45 minute classes
                  </li>
                </ul>
                <Link href="/book" className="mt-6 block">
                  <Button className="w-full">View Available Classes</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Semi-Private */}
            <Card className="transition-shadow hover:shadow-lg">
              <CardContent className="p-6 text-center">
                <Badge variant="outline" className="mb-3">
                  Semi-Private
                </Badge>
                <div className="mt-2">
                  <span className="font-heading text-4xl font-bold">$280</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  per session (8 lessons, 2 students)
                </p>
                <ul className="mt-5 space-y-2 text-left text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    Personalized attention
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    All ages and skill levels
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    30 minute classes
                  </li>
                </ul>
                <Link href="/book" className="mt-6 block">
                  <Button variant="outline" className="w-full">
                    View Available Classes
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Private */}
            <Card className="relative overflow-hidden transition-shadow hover:shadow-lg">
              <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
              <CardContent className="p-6 text-center">
                <Badge
                  variant="secondary"
                  className="mb-3 bg-accent/10 text-accent"
                >
                  Private Lessons
                </Badge>
                <div className="mt-2">
                  <span className="text-sm text-muted-foreground">From </span>
                  <span className="font-heading text-4xl font-bold">$47</span>
                  <span className="text-muted-foreground"> /lesson</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Single lessons or save with packages
                </p>
                <ul className="mt-5 space-y-2 text-left text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    One-on-one instruction
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    Flexible scheduling
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    4-pack and 8-pack savings
                  </li>
                </ul>
                <Link href="/book" className="mt-6 block">
                  <Button variant="outline" className="w-full">
                    View Available Classes
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
            Military, member, sibling &amp; early-bird discounts available — up to 25% off.
            $30 annual registration fee per family.
          </p>
        </div>
      </section>

      {/* ── VISIT US ── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">
            Visit Us
          </h2>

          <div className="mt-14 grid gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-semibold">
                    Address
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    301 E FM 2410 Rd
                    <br />
                    Harker Heights, TX 76548
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="size-5" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-semibold">Phone</h3>
                  <a
                    href="tel:+12542135543"
                    className="mt-0.5 text-sm text-accent hover:underline"
                  >
                    (254) 213-5543
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="size-5" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-semibold">Email</h3>
                  <a
                    href="mailto:swim@hacswim.com"
                    className="mt-0.5 text-sm text-accent hover:underline"
                  >
                    swim@hacswim.com
                  </a>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm font-medium">Pool Season</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Our outdoor pool season typically runs April through October.
                  Session schedules are published 2–4 weeks before each session
                  begins. Sign up for notifications to be the first to know!
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border shadow-sm">
              <iframe
                src="https://maps.google.com/maps?q=301+E+FM+2410+Rd+Harker+Heights+TX+76548&output=embed"
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Heights Athletic Club location"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-y bg-muted/40 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Everything you need to know before enrolling.
          </p>

          <Accordion className="mt-12">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent px-6 py-16 text-center text-white shadow-xl sm:px-12 sm:py-20">
            <div className="absolute -left-20 -top-20 size-60 rounded-full bg-white/5" />
            <div className="absolute -bottom-16 -right-16 size-48 rounded-full bg-white/5" />

            <div className="relative">
              <Waves className="mx-auto mb-6 size-12 text-white/80" />
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">
                Ready to Dive In?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-white/80">
                Join hundreds of Harker Heights families who trust HAC Swim for
                their children&apos;s water safety and swimming education.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-white text-primary hover:bg-white/90"
                  >
                    Create Your Account
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </Link>
                <Link href="/book">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10"
                  >
                    Browse Classes
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
