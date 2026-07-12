import { interfaceEntityKey, ipEntityKey, macEntityKey, scopeFromEvidence, subnetEntityKey } from "@/evidence/evidence-scope";
import type { EntityGraph, EntityLink, EntityNode, ParsedDataset, SubnetRecord } from "@/types/network";
import { calculateSubnet } from "@/utils/ip";

export function buildEntityGraph(dataset: ParsedDataset, subnets: SubnetRecord[]): EntityGraph {
  const nodes = new Map<string, EntityNode>();
  const links = new Map<string, EntityLink>();
  const addNode = (node: EntityNode) => nodes.set(node.id, nodes.get(node.id) ? mergeNode(nodes.get(node.id)!, node) : node);
  const addLink = (link: EntityLink) => links.set(link.id, links.get(link.id) ? mergeLink(links.get(link.id)!, link) : link);

  for (const device of dataset.devices) {
    const scope = { ...scopeFromEvidence(undefined, { deviceId: device.hostname, hostname: device.hostname, vendor: device.vendor }), vrf: "global" };
    addNode({ id: `device:${device.hostname}`, type: "device", label: device.hostname, scope, evidence: [] });
  }

  for (const subnet of subnets) {
    const scope = scopeFromEvidence(undefined, { deviceId: subnet.deviceId, vrf: subnet.vrf });
    addNode({ id: subnet.id, type: "subnet", label: subnet.cidr, scope, evidence: [] });
  }

  for (const record of dataset.interfaces) {
    const scope = scopeFromEvidence(record.evidence, { vrf: record.vrf, vlan: typeof record.vlan === "number" ? record.vlan : undefined, interfaceName: record.name });
    const interfaceId = interfaceEntityKey(scope, record.name);
    addNode({ id: interfaceId, type: "interface", label: record.name, scope, evidence: record.evidence });
    addLink({ id: `owns:${scope.deviceId}:${interfaceId}`, type: "owns", sourceId: `device:${scope.deviceId}`, targetId: interfaceId, evidence: record.evidence });
    if (record.ip) {
      const ipId = ipEntityKey(scope, record.ip);
      addNode({ id: ipId, type: "ip", label: record.ip, scope, evidence: record.evidence });
      addLink({ id: `owns:${interfaceId}:${ipId}`, type: "owns", sourceId: interfaceId, targetId: ipId, evidence: record.evidence });
      if (record.prefix !== undefined) {
        const subnet = calculateSubnet(record.ip, record.prefix);
        if (subnet) addLink({ id: `contains:${subnetEntityKey(scope, subnet.cidr)}:${ipId}`, type: "contains", sourceId: subnetEntityKey(scope, subnet.cidr), targetId: ipId, evidence: record.evidence });
      }
    }
  }

  for (const record of dataset.arp) {
    if (!record.mac) continue;
    const scope = scopeFromEvidence(record.evidence, { vrf: record.vrf, vlan: record.vlan, interfaceName: record.interfaceName });
    const ipId = ipEntityKey(scope, record.ip);
    const macId = macEntityKey(scope, record.mac, record.vlan);
    addNode({ id: ipId, type: "ip", label: record.ip, scope, evidence: record.evidence });
    addNode({ id: macId, type: "mac", label: record.mac, scope, evidence: record.evidence });
    addLink({ id: `observed:${ipId}:${macId}`, type: "observed-as", sourceId: ipId, targetId: macId, evidence: record.evidence });
  }

  for (const record of dataset.macTable) {
    const scope = scopeFromEvidence(record.evidence, { vlan: record.vlan, interfaceName: record.port });
    const macId = macEntityKey(scope, record.mac, record.vlan);
    const interfaceId = interfaceEntityKey(scope, record.port);
    addNode({ id: macId, type: "mac", label: record.mac, scope, evidence: record.evidence });
    addNode({ id: interfaceId, type: "interface", label: record.port, scope, evidence: record.evidence });
    addLink({ id: `learned:${macId}:${interfaceId}`, type: "learned-on", sourceId: macId, targetId: interfaceId, evidence: record.evidence });
  }

  return { nodes: [...nodes.values()], links: [...links.values()] };
}

function mergeNode(current: EntityNode, update: EntityNode): EntityNode {
  return { ...current, evidence: uniqueEvidence([...current.evidence, ...update.evidence]) };
}

function mergeLink(current: EntityLink, update: EntityLink): EntityLink {
  return { ...current, evidence: uniqueEvidence([...current.evidence, ...update.evidence]) };
}

function uniqueEvidence(items: EntityNode["evidence"]): EntityNode["evidence"] {
  return items.filter((item, index, all) => all.findIndex(candidate => candidate.device === item.device && candidate.command === item.command && candidate.line === item.line) === index);
}
