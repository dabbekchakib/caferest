"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { ArrowLeft, MailCheck } from "lucide-react";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/validations/auth";
import { createAuthResolver } from "@/lib/validation/zod-resolver";
import { resetPasswordForEmail } from "@/lib/auth/auth-service";
import { createClient } from "@/lib/supabase/client";
import type { AuthClientLike } from "@/lib/auth/auth-types";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AuthShell } from "./auth-shell";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resolver = useMemo(
    () =>
      createAuthResolver(forgotPasswordSchema, (key, params) =>
        tv(key, params)
      ),
    [tv]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver,
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);
    try {
      const { error } = await resetPasswordForEmail(
        createClient() as unknown as AuthClientLike,
        values.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );
      if (error) {
        setFormError(t("error.generic"));
        return;
      }
      setSent(true);
    } catch {
      setFormError(t("error.network"));
    }
  }

  if (sent) {
    return (
      <AuthShell
        title={t("forgot.successTitle")}
        footer={
          <Link
            href="/login"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("forgot.backToLogin")}
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("forgot.successDescription")}
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle")}
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-medium text-[var(--color-primary)] hover:underline"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("forgot.backToLogin")}
        </Link>
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
          htmlFor="forgot-email"
          required
          error={errors.email?.message}
        >
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("forgot.emailPlaceholder")}
            disabled={isSubmitting}
            error={errors.email?.message}
            {...register("email")}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? t("forgot.submitting") : t("forgot.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
