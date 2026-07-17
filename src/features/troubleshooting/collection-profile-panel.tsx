"use client";

import { useMemo, useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COLLECTION_PROFILES, missingCollectionCommands } from "@/features/troubleshooting/collection-profiles";
import { translations, type Language } from "@/constants/translations";
import type { AnalysisResult } from "@/types/network";

export function CollectionProfilePanel({ result, language }: { result: AnalysisResult; language: Language }) {
  const [profileId, setProfileId] = useState(COLLECTION_PROFILES[0].id);
  const profile = COLLECTION_PROFILES.find(item => item.id === profileId) ?? COLLECTION_PROFILES[0];
  const missing = useMemo(() => missingCollectionCommands(result, profile), [profile, result]);
  const labels = translations[language].collection;
  const copy = (commands: string[]) => void navigator.clipboard?.writeText(commands.join("\n"));
  return <Card>
    <CardHeader><CardTitle>{labels.title}</CardTitle><CardDescription>{labels.subtitle}</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <select value={profile.id} onChange={event => setProfileId(event.target.value as typeof profileId)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" aria-label={labels.profile}>
        {COLLECTION_PROFILES.map(item => <option key={item.id} value={item.id}>{item.title[language]}</option>)}
      </select>
      <p className="text-sm text-muted-foreground">{profile.description[language]}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => copy(profile.commands.map(item => item.command))}><ClipboardCopy className="h-4 w-4" />{labels.copyAll}</Button><Button type="button" variant="outline" onClick={() => copy(missing.map(item => item.command))} disabled={!missing.length}>{labels.copyMissing}</Button></div>
      <div className="overflow-auto rounded-lg border border-cyan-400/15"><table className="w-full text-left text-xs"><thead><tr className="border-b border-cyan-400/15 text-muted-foreground"><th className="p-3">{labels.command}</th><th className="p-3">{labels.reason}</th><th className="p-3">{labels.state}</th></tr></thead><tbody>{profile.commands.map(item => { const isMissing = missing.includes(item); return <tr key={item.command} className="border-b border-cyan-400/10"><td className="p-3 font-mono text-cyan-100">{item.command}</td><td className="p-3 text-muted-foreground">{item.reason[language]}</td><td className="p-3">{isMissing ? labels.missing : labels.collected}</td></tr>; })}</tbody></table></div>
    </CardContent>
  </Card>;
}
