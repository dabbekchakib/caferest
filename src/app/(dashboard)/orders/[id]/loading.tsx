import { useTranslations } from "next-intl";
import { LoadingState } from "@/components/shared/loading-state";

export default function OrderDetailLoading() {
  const t = useTranslations("common");
  return (
    <div className="p-4 sm:p-6">
      <LoadingState label={t("common.loading")} />
    </div>
  );
}
