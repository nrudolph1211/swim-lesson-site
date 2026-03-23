import type { Metadata } from "next";
import { SurveyForm } from "@/components/survey/SurveyForm";

export const metadata: Metadata = { title: "Session Survey" };

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ swimmerId: string; sessionId: string }>;
}) {
  const { swimmerId, sessionId } = await params;

  return <SurveyForm swimmerId={swimmerId} sessionId={sessionId} />;
}
