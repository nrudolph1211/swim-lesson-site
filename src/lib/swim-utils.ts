export const SWIM_LEVELS = [
  { id: 0, name: "Parent & Child", color: "#8E44AD", textColor: "#FFFFFF", description: "Parent-assisted water exploration" },
  { id: 1, name: "Water Introduction", color: "#2980B9", textColor: "#FFFFFF", description: "Comfort and safety in the water" },
  { id: 2, name: "Beginner", color: "#219A52", textColor: "#FFFFFF", description: "Independent floating and gliding" },
  { id: 3, name: "Intermediate", color: "#F1C40F", textColor: "#1A1A1A", description: "Stroke basics and endurance" },
  { id: 4, name: "Advanced", color: "#D35400", textColor: "#FFFFFF", description: "Full strokes and technique" },
  { id: 5, name: "Pre-Competitive", color: "#C0392B", textColor: "#FFFFFF", description: "Race-ready skills and IM" },
] as const;

export type SwimLevel = (typeof SWIM_LEVELS)[number];

export function getLevelById(id: number): SwimLevel | undefined {
  return SWIM_LEVELS.find((level) => level.id === id);
}

export function getLevelColor(level: number): string {
  return getLevelById(level)?.color ?? "#6B7280";
}

export function getLevelTextColor(level: number): string {
  return getLevelById(level)?.textColor ?? "#FFFFFF";
}

export function getLevelName(level: number): string {
  return getLevelById(level)?.name ?? `Level ${level}`;
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatPriceDollars(dollars: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(dollars);
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function recommendLevel(answers: boolean[]): number {
  let level = 1;
  for (const answer of answers) {
    if (!answer) break;
    level++;
  }
  return Math.min(level, 5);
}

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  parent_child: "Parent & Child",
  preschool_group: "Preschool Group",
  youth_beginner: "Youth Beginner",
  youth_intermediate: "Youth Intermediate",
  teen_adult: "Teen/Adult",
  semi_private: "Semi-Private",
  private_single: "Private (Single)",
  private_4pack: "Private (4-Pack)",
  private_8pack: "Private (8-Pack)",
};

export function formatProgramType(programType: string | null | undefined): string {
  if (!programType) return "—";
  return PROGRAM_TYPE_LABELS[programType] ?? programType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
