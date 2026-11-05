// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { Suspense } from "react";
import { AuthForm } from "@/components/ui/auth-form";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
