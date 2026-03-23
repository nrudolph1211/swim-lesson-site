import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12">
          <Skeleton className="h-[460px] w-full max-w-md rounded-lg" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
