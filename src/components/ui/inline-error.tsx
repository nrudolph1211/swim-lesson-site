"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function InlineError({
  message = "Something went wrong. Please try again.",
  onRetry,
  className,
}: InlineErrorProps) {
  return (
    <div className={`flex min-h-[30vh] flex-col items-center justify-center gap-4 px-4 ${className ?? ""}`}>
      <AlertTriangle className="size-10 text-destructive" />
      <h2 className="font-heading text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 size-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
