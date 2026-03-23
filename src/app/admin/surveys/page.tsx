import type { Metadata } from "next";
import { SurveysManager } from "@/components/admin/surveys/SurveysManager";

export const metadata: Metadata = { title: "Surveys" };

export default function AdminSurveysPage() {
  return <SurveysManager />;
}
