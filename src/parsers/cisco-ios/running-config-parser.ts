import type { CommandBlock, ConfigFeatureCategory, DhcpExcludedRangeRecord, DhcpPoolRecord, InterfaceRecord, ParsedDataset, VrfRecord } from "@/types/network";
import { makeEvidence } from "@/parsers/detector/command-detector";
import { maskToPrefix } from "@/utils/ip";
import { normalizeInterface } from "@/utils/interface";
import { normalizeMac } from "@/utils/mac";
import { parseVlanId } from "@/utils/vlan";

export function parseEnhancedRunningConfig(block: CommandBlock, dataset: ParsedDataset): void {
  let currentPool: DhcpPoolRecord | null = null;
  let currentInterface: InterfaceRecord | null = null;
  let currentVrf: VrfRecord | null = null;
  let hostname = block.device;
  let version: string | undefined;
  let model: string | undefined;
  let serialNumber: string | undefined;
  let recognized = 0;
  let meaningful = 0;
  let ignored = 0;
  let switching = false;
  let routing = false;
  let sdwan = false;

  const finishPool = () => {
    if (!currentPool) return;
    currentPool.poolType = currentPool.host ? "Reservation" : currentPool.network ? "Dynamic" : "Incomplete";
    currentPool.description = currentPool.host
      ? `Static DHCP reservation for ${currentPool.host}`
      : currentPool.network
        ? `Dynamic DHCP pool ${currentPool.network}/${currentPool.prefix ?? "?"}`
        : "DHCP pool is missing a host or network statement";
    currentPool.descriptionSource = "Generated";
    currentPool.descriptionConfidence = 95;
    currentPool.descriptionEvidence = currentPool.evidence;
    dataset.dhcpPools.push(currentPool);
    currentPool = null;
  };

  const finishInterface = () => {
    if (!currentInterface) return;
    if (currentInterface.description) {
      currentInterface.descriptionSource = "CLI";
      currentInterface.descriptionConfidence = 100;
      currentInterface.descriptionEvidence = currentInterface.evidence;
    } else {
      const generated = [
        currentInterface.mode && currentInterface.mode !== "unknown" ? `${currentInterface.mode} interface` : "",
        currentInterface.accessVlan ? `VLAN ${currentInterface.accessVlan}` : "",
        currentInterface.vrf ? `VRF ${currentInterface.vrf}` : "",
        currentInterface.ip ? `${currentInterface.ip}/${currentInterface.prefix ?? "?"}` : "",
        currentInterface.dhcpClient ? "DHCP client" : ""
      ].filter(Boolean).join(" · ");
      currentInterface.description = generated || undefined;
      currentInterface.descriptionSource = generated ? "Generated" : "Unknown";
      currentInterface.descriptionConfidence = generated ? 70 : 0;
    }
    dataset.interfaces.push(currentInterface);
    currentInterface = null;
  };

  const finishVrf = () => {
    if (!currentVrf) return;
    dataset.vrfs.push(currentVrf);
    currentVrf = null;
  };

  for (const line of block.lines) {
    const text = line.text.trim();
    const evidence = makeEvidence(block, line);
    if (isIgnored(text)) {
      ignored += 1;
      continue;
    }
    meaningful += 1;
    let hit = false;

    const poolStart = text.match(/^ip dhcp pool\s+(.+)$/i);
    const interfaceStart = text.match(/^interface\s+(.+)$/i);
    const vrfStart = text.match(/^vrf definition\s+(.+)$/i);

    if (poolStart) {
      finishPool(); finishInterface(); finishVrf();
      currentPool = { name: poolStart[1].trim(), defaultRouters: [], dnsServers: [], evidence: [evidence] };
      addFeature(dataset, "DHCP", "DHCP Pool", poolStart[1].trim(), poolStart[1].trim(), evidence);
      hit = true;
    } else if (interfaceStart) {
      finishPool(); finishInterface(); finishVrf();
      const name = normalizeInterface(interfaceStart[1]) ?? interfaceStart[1].trim();
      currentInterface = { name, vlan: parseVlanId(name), mode: /^(Vlan|Loopback|Tunnel)/i.test(name) ? "routed" : "unknown", shutdown: false, servicePolicies: [], evidence: [evidence] };
      addFeature(dataset, "Interface", "Interface", name, name, evidence);
      hit = true;
    } else if (vrfStart) {
      finishPool(); finishInterface(); finishVrf();
      currentVrf = { name: vrfStart[1].trim(), addressFamilies: [], interfaces: [], evidence: [evidence] };
      addFeature(dataset, "Routing", "VRF", vrfStart[1].trim(), vrfStart[1].trim(), evidence);
      routing = true;
      hit = true;
    }

    if (!hit && currentPool) {
      const network = text.match(/^network\s+(\S+)\s+(\S+)/i);
      const host = text.match(/^host\s+(\S+)\s+(\S+)/i);
      const client = text.match(/^client-identifier\s+(\S+)/i);
      const hardware = text.match(/^hardware-address\s+(\S+)/i);
      const router = text.match(/^default-router\s+(.+)/i);
      const dns = text.match(/^dns-server\s+(.+)/i);
      if (network) {
        currentPool.network = network[1]; currentPool.prefix = prefix(network[2]); currentPool.evidence.push(evidence); hit = true;
      } else if (host) {
        currentPool.host = host[1]; currentPool.network = host[1]; currentPool.prefix = prefix(host[2]); currentPool.evidence.push(evidence); hit = true;
      } else if (client) {
        currentPool.clientIdentifier = client[1]; currentPool.hardwareAddress = normalizeMac(client[1]) ?? undefined; currentPool.evidence.push(evidence); hit = true;
      } else if (hardware) {
        currentPool.hardwareAddress = normalizeMac(hardware[1]) ?? hardware[1]; currentPool.evidence.push(evidence); hit = true;
      } else if (router) {
        currentPool.defaultRouters.push(...router[1].split(/\s+/)); currentPool.evidence.push(evidence); hit = true;
      } else if (dns) {
        currentPool.dnsServers.push(...dns[1].split(/\s+/)); currentPool.evidence.push(evidence); hit = true;
      } else if (/^update arp$/i.test(text)) {
        currentPool.updateArp = true; currentPool.evidence.push(evidence); hit = true;
      }
    }

    if (!hit && currentInterface) {
      const description = text.match(/^description\s+(.+)$/i);
      const vrf = text.match(/^(?:vrf forwarding|ip vrf forwarding)\s+(.+)$/i);
      const ip = text.match(/^ip address\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)(?:\s+(secondary))?/i);
      const access = text.match(/^switchport access vlan\s+(\d+)/i);
      const voice = text.match(/^switchport voice vlan\s+(\d+)/i);
      const native = text.match(/^switchport trunk native vlan\s+(\d+)/i);
      const allowed = text.match(/^switchport trunk allowed vlan\s+(.+)/i);
      const mode = text.match(/^switchport mode\s+(access|trunk)/i);
      const channel = text.match(/^channel-group\s+(\d+)\s+mode\s+(\S+)/i);
      const policy = text.match(/^service-policy\s+(input|output)\s+(.+)/i);
      if (description) {
        currentInterface.description = description[1].trim(); currentInterface.evidence.push(evidence); hit = true;
      } else if (vrf) {
        currentInterface.vrf = vrf[1].trim(); currentInterface.evidence.push(evidence); routing = true; hit = true;
      } else if (ip) {
        if (currentInterface.ip) {
          dataset.interfaces.push({ ...currentInterface, ip: ip[1], prefix: maskToPrefix(ip[2]) ?? undefined, secondary: Boolean(ip[3]), mode: "routed", evidence: [...currentInterface.evidence, evidence] });
        } else {
          currentInterface.ip = ip[1]; currentInterface.prefix = maskToPrefix(ip[2]) ?? undefined; currentInterface.secondary = Boolean(ip[3]); currentInterface.mode = "routed"; currentInterface.evidence.push(evidence);
        }
        routing = true; hit = true;
      } else if (/^ip address dhcp\b/i.test(text)) {
        currentInterface.dhcpClient = true; currentInterface.mode = "routed"; currentInterface.evidence.push(evidence); routing = true; hit = true;
      } else if (access) {
        currentInterface.accessVlan = Number(access[1]); currentInterface.vlan = Number(access[1]); currentInterface.mode = "access"; currentInterface.evidence.push(evidence); switching = true; hit = true;
      } else if (voice) {
        currentInterface.voiceVlan = Number(voice[1]); currentInterface.evidence.push(evidence); switching = true; hit = true;
      } else if (native) {
        currentInterface.nativeVlan = Number(native[1]); currentInterface.evidence.push(evidence); switching = true; hit = true;
      } else if (allowed) {
        currentInterface.allowedVlans = allowed[1].trim(); currentInterface.evidence.push(evidence); switching = true; hit = true;
      } else if (mode) {
        currentInterface.mode = mode[1].toLowerCase() as "access" | "trunk"; currentInterface.evidence.push(evidence); switching = true; hit = true;
      } else if (text === "shutdown") {
        currentInterface.shutdown = true; currentInterface.status = "disabled"; currentInterface.evidence.push(evidence); hit = true;
      } else if (text === "no shutdown") {
        currentInterface.shutdown = false; currentInterface.status = "enabled"; currentInterface.evidence.push(evidence); hit = true;
      } else if (channel) {
        currentInterface.channelGroup = channel[1]; currentInterface.channelMode = channel[2]; currentInterface.evidence.push(evidence); hit = true;
      } else if (/^ip dhcp snooping trust$/i.test(text)) {
        currentInterface.dhcpSnoopingTrust = true; currentInterface.evidence.push(evidence); hit = true;
      } else if (/^spanning-tree portfast\b/i.test(text)) {
        currentInterface.portfast = true; currentInterface.evidence.push(evidence); hit = true;
      } else if (/^ip nat outside$/i.test(text)) {
        currentInterface.natRole = "outside"; currentInterface.evidence.push(evidence); hit = true;
      } else if (/^ip nat inside$/i.test(text)) {
        currentInterface.natRole = "inside"; currentInterface.evidence.push(evidence); hit = true;
      } else if (policy) {
        currentInterface.servicePolicies = [...(currentInterface.servicePolicies ?? []), `${policy[1]}:${policy[2].trim()}`]; currentInterface.evidence.push(evidence); hit = true;
      } else if (/^tunnel mode sdwan$/i.test(text)) {
        currentInterface.evidence.push(evidence); sdwan = true; hit = true;
      } else if (/^(no ip redirects|ip mtu|mtu|arp timeout|load-interval|negotiation|endpoint-tracker|tunnel source|ipv6|no ipv6|switchport|spanning-tree|storm-control)\b/i.test(text)) {
        currentInterface.evidence.push(evidence); hit = true;
      }
    }

    if (!hit && currentVrf) {
      const description = text.match(/^description\s+(.+)$/i);
      const family = text.match(/^address-family\s+(.+)$/i);
      if (description) {
        currentVrf.description = description[1].trim(); currentVrf.descriptionSource = "CLI"; currentVrf.descriptionConfidence = 100; currentVrf.evidence.push(evidence); hit = true;
      } else if (family) {
        currentVrf.addressFamilies.push(family[1].trim()); currentVrf.evidence.push(evidence); hit = true;
      } else if (/^exit-address-family$/i.test(text)) {
        currentVrf.evidence.push(evidence); hit = true;
      }
    }

    if (!hit) {
      const excluded = text.match(/^ip dhcp excluded-address(?:\s+vrf\s+(\S+))?\s+(\d+\.\d+\.\d+\.\d+)(?:\s+(\d+\.\d+\.\d+\.\d+))?/i);
      const host = text.match(/^hostname\s+(\S+)/i);
      const ver = text.match(/^version\s+(.+)/i);
      const udi = text.match(/^license udi pid\s+(\S+)\s+sn\s+(\S+)/i);
      const route = text.match(/^ip route(?:\s+vrf\s+(\S+))?\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i);
      const acl = text.match(/^access-list\s+(\S+)\s+(permit|deny|remark)\s+(.+)/i);
      if (excluded) {
        const record: DhcpExcludedRangeRecord = {
          vrf: excluded[1],
          startIp: excluded[2],
          endIp: excluded[3] ?? excluded[2],
          evidence: [evidence],
          description: excluded[3] ? `DHCP excluded range ${excluded[2]}-${excluded[3]}` : `DHCP excluded address ${excluded[2]}`,
          descriptionSource: "CLI",
          descriptionConfidence: 100
        };
        dataset.dhcpExcludedRanges.push(record);
        addFeature(dataset, "DHCP", "DHCP Excluded Address", excluded[3] ? `${excluded[2]}-${excluded[3]}` : excluded[2], excluded[1] ?? "global", evidence);
        hit = true;
      } else if (host) {
        hostname = host[1]; addFeature(dataset, "Identity", "Hostname", hostname, hostname, evidence); hit = true;
      } else if (ver) {
        version = ver[1].trim(); addFeature(dataset, "Identity", "Software Version", version, hostname, evidence); hit = true;
      } else if (udi) {
        model = udi[1]; serialNumber = udi[2]; addFeature(dataset, "Identity", "Hardware Identity", `${model} / ${serialNumber}`, hostname, evidence); hit = true;
      } else if (route) {
        const nextHop = /^\d+\.\d+\.\d+\.\d+$/.test(route[4]) ? route[4] : route[5];
        dataset.staticRoutes.push({ vrf: route[1], destination: route[2], mask: route[3], prefix: maskToPrefix(route[3]) ?? undefined, nextHop, outgoingInterface: nextHop === route[4] ? undefined : route[4], evidence: [evidence], description: `Static route to ${route[2]}/${maskToPrefix(route[3]) ?? "?"}`, descriptionSource: "Generated", descriptionConfidence: 95 });
        addFeature(dataset, "Routing", "Static Route", text, route[1] ?? "global", evidence); routing = true; hit = true;
      } else if (acl) {
        dataset.accessLists.push({ name: acl[1], family: "ipv4", aclType: "numbered", action: acl[2].toLowerCase() as "permit" | "deny" | "remark", expression: acl[3].trim(), evidence: [evidence] });
        addFeature(dataset, "Security", "Access List", acl[1], acl[1], evidence); hit = true;
      } else {
        const feature = classify(text);
        if (feature) {
          addFeature(dataset, feature[0], feature[1], feature[2] ? "[SENSITIVE CONFIGURED]" : text, hostname, evidence);
          switching ||= feature[0] === "Switching";
          routing ||= feature[0] === "Routing";
          sdwan ||= feature[0] === "SD-WAN";
          hit = true;
        }
      }
    }

    if (hit) recognized += 1;
  }

  finishPool(); finishInterface(); finishVrf();
  for (const intf of dataset.interfaces) {
    if (!intf.vrf) continue;
    const vrf = dataset.vrfs.find(item => item.name === intf.vrf);
    if (vrf && !vrf.interfaces.includes(intf.name)) vrf.interfaces.push(intf.name);
  }

  const role = sdwan ? "SD-WAN Router" : switching && routing ? "Layer 3 Switch" : switching ? "Switch" : routing ? "Router" : "Network Device";
  dataset.devices.push({ hostname, vendor: "cisco", os: sdwan || version?.startsWith("17") ? "Cisco IOS XE" : "Cisco IOS", version, model, serialNumber, role, description: `${role}${model ? ` ${model}` : ""}${version ? ` running ${version}` : ""}`, descriptionSource: "Generated", descriptionConfidence: model || version ? 92 : 75, commands: ["show running-config"] });
  dataset.parserCoverage = { totalMeaningfulLines: meaningful, recognizedLines: recognized, ignoredLines: ignored, unrecognizedLines: Math.max(0, meaningful - recognized), coveragePercent: meaningful ? Math.round((recognized / meaningful) * 100) : 100 };
}

function prefix(value: string): number | undefined {
  return value.startsWith("/") ? Number(value.slice(1)) : maskToPrefix(value) ?? undefined;
}

function isIgnored(text: string): boolean {
  return !text || text === "!" || /^Building configuration/i.test(text) || /^Current configuration/i.test(text) || /^login as:/i.test(text) || /^Pre-authentication banner/i.test(text) || /^Keyboard-interactive authentication/i.test(text) || /^End of banner message/i.test(text) || /^\|/.test(text) || /^(?:[0-9A-F]{8}\s+){3,}/i.test(text) || /^(quit|certificate self-signed)/i.test(text);
}

function addFeature(dataset: ParsedDataset, category: ConfigFeatureCategory, feature: string, value: string, scope: string, evidence: ReturnType<typeof makeEvidence>): void {
  dataset.configFeatures.push({ category, feature, value, scope, status: "Configured", description: `${feature} configuration detected.`, descriptionSource: "Generated", descriptionConfidence: 90, descriptionEvidence: [evidence], evidence: [evidence] });
}

function classify(text: string): [ConfigFeatureCategory, string, boolean?] | null {
  const rules: Array<[RegExp, ConfigFeatureCategory, string, boolean?]> = [
    [/^aaa\b/i, "Security", "AAA"],
    [/^(tacacs-server|radius-server|server-private|username|enable secret|enable password)\b/i, "Security", "Credential or AAA Server", true],
    [/^snmp-server\b/i, "Management", "SNMP", true],
    [/^logging\b/i, "Monitoring", "Logging"],
    [/^ntp\b/i, "Management", "NTP"],
    [/^ip dhcp snooping\b/i, "Security", "DHCP Snooping"],
    [/^ip arp inspection\b/i, "Security", "Dynamic ARP Inspection"],
    [/^spanning-tree\b/i, "Switching", "Spanning Tree"],
    [/^vlan\b/i, "Switching", "VLAN"],
    [/^(lldp run|cdp run)$/i, "Management", "Discovery Protocol"],
    [/^router omp\b/i, "SD-WAN", "OMP"],
    [/^(flow record|flow exporter|flow monitor|performance monitor)\b/i, "Monitoring", "Flow and Performance Monitoring"],
    [/^(class-map|policy-map)\b/i, "QoS", "QoS Policy"],
    [/^endpoint-tracker\b/i, "SD-WAN", "Endpoint Tracker"],
    [/^ip nat\b/i, "Routing", "NAT"],
    [/^ip host\b/i, "Services", "Static Host Entry"],
    [/^(no )?ip http (secure-)?server$/i, "Security", "Web Management"],
    [/^(no )?ip bootp server$/i, "Services", "BOOTP"],
    [/^service\b/i, "Services", "IOS Service"],
    [/^crypto\b/i, "PKI", "Cryptography"],
    [/^line\s+(con|vty|aux)\b/i, "Management", "Management Line"],
    [/^ipv6 unicast-routing$/i, "Routing", "IPv6 Routing"],
    [/^(fhrp version|standby|vrrp)\b/i, "Routing", "First-Hop Redundancy"],
    [/^router\s+/i, "Routing", "Routing Protocol"],
    [/^clock timezone\b/i, "Management", "Timezone"],
    [/^ip domain-name\b/i, "Management", "Domain Name"],
    [/^login\b/i, "Security", "Login Logging"],
    [/^(password encryption aes|service password-encryption)$/i, "Security", "Password Protection"]
  ];
  for (const [pattern, category, feature, sensitive] of rules) if (pattern.test(text)) return [category, feature, sensitive];
  return null;
}
