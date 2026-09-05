"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { loginSchema, type LoginValues } from "@/validations/auth";
import { createAuthResolver } from "@/lib/validation/zod-resolver";
import {
  getCurrentProfile,
  isProfileActive,
  signInWithPassword,
  signOut,
} from "@/lib/auth/auth-service";
import { resolveAuthFaultKey } from "@/lib/auth/auth-errors";
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  getSafeRedirect,
} from "@/lib/auth/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import type { AuthClientLike } from "@/lib/auth/auth-types";
import { useAuth } from "@/hooks/use-auth";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AuthShell } from "./auth-shell";

export interface LoginFormProps {
  /** Sanitized post-login target (already validated by the server page). */
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const resolver = useMemo(
    () => createAuthResolver(loginSchema, (key, params) => tv(key, params)),
    [tv]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver,
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(DEFAULT_AUTHENTICATED_ROUTE);
    }
  }, [authLoading, user, router]);

  async function onSubmit(values: LoginValues) {
    setFormError(null);

    try {
      const client = createClient() as unknown as AuthClientLike;
      const result = await signInWithPassword(client, values);
      if (result.error || !result.user) {
        setFormError(t(resolveAuthFaultKey(result.error)));
        return;
      }

      const { profile } = await getCurrentProfile(client);
      if (!isProfileActive(profile)) {
        // Never keep a working session for a disabled account.
        await signOut(client);
        router.replace("/account-disabled");
        router.refresh();
        return;
      }

      const next = getSafeRedirect(redirectTo, DEFAULT_AUTHENTICATED_ROUTE);
      router.replace(next);
      router.refresh();
    } catch {
      setFormError(t("error.network"));
    }
  }

  return (
    <AuthShell
      title={t("signin.title")}
      subtitle={t("signin.subtitle")}
      footer={
        <p className="flex items-center justify-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" aria-hidden />
          {t("securityNote")}
        </p>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        {formError && (
          <Alert variant="danger" title={t("loginError")}>
            {formError}
          </Alert>
        )}

        <Field
          label={t("email")}
          htmlFor="login-email"
          required
          error={errors.email?.message}
        >
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("signin.emailPlaceholder")}
            disabled={isSubmitting}
            error={errors.email?.message}
            {...register("email")}
          />
        </Field>

        <Field
          label={t("password")}
          htmlFor="login-password"
          required
          error={errors.password?.message}
        >
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("signin.passwordPlaceholder")}
              disabled={isSubmitting}
              error={errors.password?.message}
              className="pr-11"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? t("signin.hidePassword")
                  : t("signin.showPassword")
              }
              className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <Checkbox defaultChecked />
            {t("rememberMe")}
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("signin.forgotPasswordLink")}
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? t("signin.submitting") : t("signin.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
