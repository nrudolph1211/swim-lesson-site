import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BookPageClient } from "@/components/book/BookPageClient";

function BookLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<BookLoading />}>
      <BookPageClient />
    </Suspense>
  );
}

export const metadata = {
  title: "Book Swim Lessons",
  description: "Browse available swim classes and enroll your child at Heights Athletic Club.",
};
