import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

interface ResetPasswordRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordRoute({
  searchParams,
}: ResetPasswordRouteProps) {
  const params = await searchParams;
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  return <ResetPasswordForm code={code} />;
}
