import type { Metadata } from "next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;

  return (
    <div className="flex flex-col gap-4">
      {message ? (
        <Alert variant="warning">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm />
    </div>
  );
}
