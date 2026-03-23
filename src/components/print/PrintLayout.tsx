"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

interface PrintLayoutProps {
  children: React.ReactNode;
  title: string;
  autoPrint?: boolean;
}

export function PrintLayout({ children, title, autoPrint = true }: PrintLayoutProps) {
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (autoPrint && !hasPrinted.current) {
      hasPrinted.current = true;
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <>
      <style jsx global>{`
        @media print {
          /* Hide everything from normal layout */
          nav, footer, aside, header,
          [data-print-hide],
          .print-hide {
            display: none !important;
          }

          /* Reset page for clean output */
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
            line-height: 1.4 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Page setup */
          @page {
            margin: 0.5in;
            size: letter portrait;
          }

          /* Make print container full width */
          .print-container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Table styles */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
          }
          th, td {
            border: 1px solid #333 !important;
            padding: 4px 6px !important;
            font-size: 10pt !important;
          }
          th {
            background: #e5e5e5 !important;
            font-weight: 700 !important;
          }

          /* Preserve level badge colors */
          .print-badge {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        @media screen {
          .print-container {
            max-width: 900px;
            margin: 0 auto;
            padding: 24px;
          }
        }
      `}</style>

      {/* Screen-only action bar */}
      <div className="print-hide sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-6 py-3">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 size-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="print-container">
        {children}
      </div>
    </>
  );
}
