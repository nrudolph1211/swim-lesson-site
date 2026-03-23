import type { Metadata } from "next";
import { PayrollManager } from "@/components/admin/payroll/PayrollManager";

export const metadata: Metadata = { title: "Payroll" };

export default function AdminPayrollPage() {
  return <PayrollManager />;
}
