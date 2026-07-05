"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAnalysisStore } from "@/store/analysis-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ConfigurationView() {
  const result = useAnalysisStore(state => state.result);
  const [query, setQuery] = useState("");

  const features = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    return result.configFeatures.filter(item => {
      const text = [item.category, item.feature, item.scope, item.value, item.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !q || text.includes(q);
    });
  }, [query, result]);

  if (!result) {
    return (
      <main className="min-h-screen p-6">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Configuration Analysis</CardTitle>
            <CardDescription>Analyze CLI data before opening this view.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href="/?view=import">Open CLI Import</Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const coverage = result.parserCoverage;

  return (
    <main className="min-h-screen space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="cyber-brand text-xl font-semibold">Complete Configuration Analysis</h1>
          <p className="text-sm text-muted-foreground">Structured objects, descriptions, evidence, and parser coverage.</p>
        </div>
        <Button asChild variant="outline"><Link href="/?view=overview">Dashboard</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Coverage" value={`${coverage.coveragePercent}%`} />
        <Metric label="Recognized" value={coverage.recognizedLines} />
        <Metric label="Interfaces" value={result.interfaces.length} />
        <Metric label="DHCP Pools" value={result.dhcpPools.length} />
        <Metric label="VRFs / Routes" value={`${result.vrfs.length} / ${result.staticRoutes.length}`} />
        <Metric label="ACL Rules" value={result.accessLists.length} />
      </div>

      <Card>
        <CardHeader><CardTitle>Interfaces</CardTitle><CardDescription>Description, mode, VLAN, IP, VRF, channel, and security state.</CardDescription></CardHeader>
        <CardContent>
          <DataTable headers={["Interface", "Description", "State", "Mode", "VLAN", "IP", "VRF", "Options"]}>
            {result.interfaces.map((item, index) => (
              <TableRow key={`${item.name}-${item.ip ?? "none"}-${index}`}>
                <TableCell className="font-mono">{item.name}</TableCell>
                <TableCell>{item.description ?? "-"}</TableCell>
                <TableCell>{item.status ?? (item.shutdown ? "disabled" : "configured")}</TableCell>
                <TableCell>{item.mode ?? "unknown"}</TableCell>
                <TableCell>{item.accessVlan ?? item.vlan ?? "-"}</TableCell>
                <TableCell className="font-mono">{item.dhcpClient ? "DHCP" : item.ip ? `${item.ip}/${item.prefix ?? "?"}` : "-"}</TableCell>
                <TableCell>{item.vrf ?? "global"}</TableCell>
                <TableCell className="text-xs">{[item.channelGroup ? `Po${item.channelGroup}` : "", item.dhcpSnoopingTrust ? "DHCP trust" : "", item.portfast ? "PortFast" : "", item.natRole ? `NAT ${item.natRole}` : "", ...(item.servicePolicies ?? [])].filter(Boolean).join(" · ") || "-"}</TableCell>
              </TableRow>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>DHCP Pools and Reservations</CardTitle><CardDescription>Host/network, client identifier, gateway, DNS, update-ARP, and descriptions.</CardDescription></CardHeader>
        <CardContent>
          <DataTable headers={["Pool", "Type", "Host / Network", "Client ID", "Gateway", "DNS", "ARP", "Description"]}>
            {result.dhcpPools.map((item, index) => (
              <TableRow key={`${item.name}-${index}`}>
                <TableCell className="font-mono">{item.name}</TableCell>
                <TableCell>{item.poolType ?? "Unknown"}</TableCell>
                <TableCell className="font-mono">{item.host ?? item.network ?? "Missing"}{item.prefix !== undefined ? `/${item.prefix}` : ""}</TableCell>
                <TableCell className="font-mono text-xs">{item.clientIdentifier ?? item.hardwareAddress ?? "-"}</TableCell>
                <TableCell>{item.defaultRouters.join(", ") || "-"}</TableCell>
                <TableCell className="text-xs">{item.dnsServers.join(", ") || "-"}</TableCell>
                <TableCell>{item.updateArp ? "Yes" : "No"}</TableCell>
                <TableCell>{item.description ?? "-"}</TableCell>
              </TableRow>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <SimpleRecords title="VRFs" rows={result.vrfs.map(item => [item.name, item.description ?? "-", item.addressFamilies.join(", ") || "-", item.interfaces.join(", ") || "-"])} headers={["VRF", "Description", "Families", "Interfaces"]} />
        <SimpleRecords title="Static Routes" rows={result.staticRoutes.map(item => [item.vrf ?? "global", `${item.destination}/${item.prefix ?? "?"}`, item.nextHop ?? "-", item.outgoingInterface ?? "-"])} headers={["VRF", "Destination", "Next Hop", "Interface"]} />
      </div>

      <Card>
        <CardHeader><CardTitle>All Recognized Features</CardTitle><CardDescription>Search all recognized command families. Protected values are summarized.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <input value={query} onChange={event => setQuery(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" placeholder="Search category, feature, scope, or description" />
          <DataTable headers={["Category", "Feature", "Scope", "Status", "Value", "Description", "Evidence"]}>
            {features.map((item, index) => (
              <TableRow key={`${item.feature}-${index}`}>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.feature}</TableCell>
                <TableCell>{item.scope ?? "-"}</TableCell>
                <TableCell>{item.status ?? "Configured"}</TableCell>
                <TableCell className="max-w-96 break-words font-mono text-xs">{item.value ?? "-"}</TableCell>
                <TableCell>{item.description ?? "-"}</TableCell>
                <TableCell>{item.evidence.map(e => `L${e.line}`).join(", ")}</TableCell>
              </TableRow>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></CardContent></Card>;
}

function SimpleRecords({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><DataTable headers={headers}>{rows.map((row, index) => <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>)}</DataTable></CardContent></Card>;
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="max-h-[620px] overflow-auto rounded-lg border border-border"><Table><TableHeader><TableRow>{headers.map(item => <TableHead key={item}>{item}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div>;
}
