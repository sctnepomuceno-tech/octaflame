import type { Metadata } from "next";

import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ChangePasswordPage() {
  return <ChangePasswordForm />;
}
