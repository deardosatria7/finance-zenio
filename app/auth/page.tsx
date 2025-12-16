// app/auth/page.tsx
import { getUserSessionSSR } from "@/lib/actions/sessions";
import { redirect } from "next/navigation";
import { LoginForm } from "../../components/login-form";

export default async function AuthPage() {
  const session = await getUserSessionSSR().catch(() => null);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div>
      <LoginForm />
    </div>
  );
}
