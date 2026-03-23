import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Create Account",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12">
          <Skeleton className="h-[680px] w-full max-w-md rounded-lg" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
