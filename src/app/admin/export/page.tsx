import type { Metadata } from "next";
import { DataExport } from "@/components/admin/export/DataExport";

export const metadata: Metadata = { title: "Export Data" };

export default function AdminExportPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="font-heading text-3xl font-bold">Export Data</h1>
      <p className="mt-2 text-muted-foreground">
        Download bulk data exports as CSV files.
      </p>
      <div className="mt-6">
        <DataExport />
      </div>
    </div>
  );
}
