"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { CheckCircle2, KeyRound, TriangleAlert } from "lucide-react";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/validations/auth";
import { createAuthResolver } from "@/lib/validation/zod-resolver";
import {
  exchangeCodeForSession,
  signOut,
  updatePassword,
} from "@/lib/auth/auth-service";
import { resolveAuthFaultKey } from "@/lib/auth/auth-errors";
import { createClient } from "@/lib/supabase/client";
import type { AuthClientLike } from "@/lib/auth/auth-types";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AuthShell } from "./auth-shell";

type Phase = "verifying" | "ready" | "invalid" | "success";

export interface ResetPasswordFormProps {
  /** PKCE recovery code from the reset link, when present. */
  code?: string;
}

export function ResetPasswordForm({ code }: ResetPasswordFormProps) {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const [phase, setPhase] = useState<Phase>("verifying");
  const [formError, setFormError] = useState<string | null>(null);

  const resolver = useMemo(
    () =>
      createAuthResolver(resetPasswordSchema, (key, params) => tv(key, params)),
    [tv]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver,
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      const client = createClient() as unknown as AuthClientLike;
      try {
        if (code) {
          const { session, error } = await exchangeCodeForSession(client, code);
          if (!active) return;
          if (error || !session?.user) {
            setPhase("invalid");
            return;
          }
        } else {
          const {
            data: { session },
          } = await client.auth.getSession();
          if (!active) return;
          if (!session?.user) {
            setPhase("invalid");
            return;
          }
        }
        setPhase("ready");
      } catch {
        if (active) setPhase("invalid");
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    try {
      const client = createClient() as unknown as AuthClientLike;

      const { user, error } = await updatePassword(client, values.password);
      if (error || !user) {
        setFormError(t(resolveAuthFaultKey(error)));
        return;
      }
      await signOut(client);
      setPhase("success");
    } catch {
      setFormError(t("error.network"));
    }
  }

  if (phase === "verifying") {
    return (
      <AuthShell title={t("reset.title")}>
        <div
          className="flex flex-col items-center justify-center gap-3 py-6 text-center"
          role="status"
        >
          <KeyRound
            className="size-8 animate-pulse text-[var(--color-primary)]"
            aria-hidden
          />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("reset.subtitle")}
          </p>
        </div>
      </AuthShell>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthShell
        title={t("reset.invalidLinkTitle")}
        footer={
          <Link
            href="/forgot-password"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("reset.backToLogin")}
          </Link>
        }
      >
        <Alert variant="warning" title={t("reset.invalidLinkTitle")}>
          {t("reset.invalidLinkDescription")}
        </Alert>
      </AuthShell>
    );
  }

  if (phase === "success") {
    return (
      <AuthShell
        title={t("reset.successTitle")}
        footer={
          <Link
            href="/login"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("reset.backToLogin")}
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("reset.successDescription")}
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("reset.title")} subtitle={t("reset.subtitle")}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        {formError && (
          <Alert variant="danger">
            <TriangleAlert className="size-4" aria-hidden />
            {formError}
          </Alert>
        )}

        <Field
          label={t("reset.newPassword")}
          htmlFor="reset-password"
          required
          error={errors.password?.message}
        >
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder={t("reset.newPasswordPlaceholder")}
            disabled={isSubmitting}
            error={errors.password?.message}
            {...register("password")}
          />
        </Field>

        <Field
          label={t("reset.confirmPassword")}
          htmlFor="reset-confirm"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("reset.confirmPasswordPlaceholder")}
            disabled={isSubmitting}
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? t("reset.submitting") : t("reset.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
