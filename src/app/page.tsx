import { ConfigurationView } from "@/components/configuration-view";
import { IpMacAuditPanel } from "@/components/ip-mac-audit-panel";
import { NetScopeApp } from "@/components/netscope-app";
import { isViewId } from "@/constants/navigation";

type PageSearchParams = {
  view?: string | string[];
};

export default async function Page({ searchParams }: { searchParams?: PageSearchParams | Promise<PageSearchParams> }) {
  const params = (await searchParams) ?? {};
  const requestedView = Array.isArray(params.view) ? params.view[0] : params.view;
  const initialView = isViewId(requestedView) ? requestedView : "import";

  if (initialView === "configuration") return <ConfigurationView />;

  return (
    <>
      <NetScopeApp initialView={initialView} />
      <IpMacAuditPanel />
    </>
  );
}
