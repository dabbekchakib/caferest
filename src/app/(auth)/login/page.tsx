import { LoginForm } from "@/components/auth/login-form";
import { getSafeRedirect } from "@/lib/auth/auth-redirect";

export const dynamic = "force-dynamic";

interface LoginRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const params = await searchParams;
  const redirectTo = getSafeRedirect(params.redirect);

  return <LoginForm redirectTo={redirectTo} />;
}
