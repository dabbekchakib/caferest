import { AppShell } from "@/components/layout/app-shell";
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
  return (
    <AppShell title="Test UI">
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Responsive Test"
          description="Tester les points de rupture mobile, tablette et desktop, ainsi que RTL et dark mode."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TestBox label="Mobile 320px" note="Rarement utilisé" />
          <TestBox label="Mobile 375px" note="iPhone" />
          <TestBox label="Tablette 768px" note="Terminal POS" />
          <TestBox label="Desktop 1280px" note="Standard" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Éléments responsives</CardTitle>
            <CardDescription>
              Le layout doit s'adapter de 320px à 1920px sans casser, et rester lisible en dark mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="danger">Danger</Button>
              <Badge variant="success">Success</Badge>
              <StatusBadge status="warning" label="En cours" />
            </div>
            <Progress value={65} variant="info" />
            <div className="flex flex-wrap gap-3">
              <ConnectionStatus status="online" />
              <ConnectionStatus status="offline" />
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-[var(--color-muted-foreground)]">
          Astuce : changez la taille de la fenêtre, activez le mode sombre via le bouton dans la topbar,
          et utilisez <code>{"dir=\"rtl\""}</code> dans les outils de développement pour tester RTL.
        </p>
      </div>
    </AppShell>
  );
}

function TestBox({ label, note }: { label: string; note: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-muted-foreground)]">OK</span>
          <StatusBadge status="success" label="Prêt" />
        </div>
      </CardContent>
    </Card>
  );
}
