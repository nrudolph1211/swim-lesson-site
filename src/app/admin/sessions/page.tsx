import { SessionsTable } from "@/components/admin/sessions/SessionsTable";

export const metadata = { title: "Sessions" };

export default function AdminSessionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Sessions</h1>
      <SessionsTable />
    </div>
  );
}
