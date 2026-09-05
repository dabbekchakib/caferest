import type { ReactNode } from "react";
import { Coffee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Centered auth card used by the login / forgot-password / reset-password /
 * account-disabled pages. Titles are passed in already translated by the
 * client form that renders this shell.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-full w-full max-w-full items-start justify-center px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-lg">
            <Coffee className="size-7" aria-hidden />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <Card className="border-[var(--color-border)] shadow-sm">
          <CardContent className="p-6 sm:p-8">{children}</CardContent>
        </Card>

        {footer && (
          <div className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
