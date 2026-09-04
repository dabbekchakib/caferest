import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Fil d'ariane" className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
          <Link href="/dashboard" className="inline-flex items-center gap-1 hover:text-[var(--color-foreground)]">
            <Home className="size-4" aria-hidden />
            <span>Accueil</span>
          </Link>
          {breadcrumbs.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
              {item.href ? (
                <Link href={item.href} className="hover:text-[var(--color-foreground)]">
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-[var(--color-foreground)]">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)]">{title}</h1>
          {description && (
            <p className="text-sm text-[var(--color-muted-foreground)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
