import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConnectionStatus } from "@/components/shared/connection-status";

export default function UiTestPage() {
  const t = useTranslations("uiTest");
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t("title2")} description={t("description")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TestBox
          label={t("breakpoints.mobile320")}
          note={t("notes.rarelyUsed")}
        />
        <TestBox label={t("breakpoints.mobile375")} note={t("notes.iphone")} />
        <TestBox
          label={t("breakpoints.tablet")}
          note={t("notes.posTerminal")}
        />
        <TestBox label={t("breakpoints.desktop")} note={t("notes.standard")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("responsiveElements")}</CardTitle>
          <CardDescription>{t("responsiveHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>{t("primary")}</Button>
            <Button variant="outline">{t("outline")}</Button>
            <Button variant="danger">{t("danger")}</Button>
            <Badge variant="success">{t("success")}</Badge>
            <StatusBadge status="warning" label={t("inProgress")} />
          </div>
          <Progress value={65} variant="info" />
          <div className="flex flex-wrap gap-3">
            <ConnectionStatus status="online" />
            <ConnectionStatus status="offline" />
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t.rich("tip", {
          code: (chunks) => (
            <code className="rounded bg-[var(--color-muted)] px-1 py-0.5">
              {chunks}
            </code>
          ),
        })}
      </p>
    </div>
  );
}

function TestBox({ label, note }: { label: string; note: string }) {
  const t = useTranslations("uiTest");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {t("ok")}
          </span>
          <StatusBadge status="success" label={t("ready")} />
        </div>
      </CardContent>
    </Card>
  );
}
