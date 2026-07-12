# dawos-agent API Coverage

dawu-manager proxies requests to dawos-agent instances running on BNG nodes. This page documents the mapping between dawu-manager's dashboard pages and the dawos-agent API endpoints they consume.

---

## Coverage Summary

dawos-agent exposes 153 HTTP endpoints across 15 feature categories. dawu-manager provides dashboard pages for all 15 categories, covering the full API surface.

---

## Endpoint Mapping by Category

### Sessions

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| List active sessions | GET | `/api/v1/sessions` |
| Terminate session | POST | `/api/v1/sessions/terminate` |
| Bulk terminate | POST | `/api/v1/bulk/terminate` |
| Session statistics | GET | `/api/v1/sessions/stats` |

### Service

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| Service status | GET | `/api/v1/service/status` |
| Service action (start/stop/restart) | POST | `/api/v1/service/action` |
| Service version | GET | `/api/v1/service/version` |
| Run command | POST | `/api/v1/service/command` |

### Config

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| Show current config | GET | `/api/v1/config/show` |
| Apply config | POST | `/api/v1/config/apply` |
| Confirm applied config | POST | `/api/v1/config/confirm` |
| Revert config | POST | `/api/v1/config/revert` |
| Config diff | GET | `/api/v1/config/diff` |
| Backup list | GET | `/api/v1/config/backups` |
| Restore backup | POST | `/api/v1/config/restore` |

### Firewall

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| List rules | GET | `/api/v1/firewall/rules` |
| Validate ruleset | POST | `/api/v1/firewall/validate` |
| Save rules | POST | `/api/v1/firewall/save` |
| NAT egress list | GET | `/api/v1/firewall/nat/egress` |
| NAT egress create | POST | `/api/v1/firewall/nat/egress` |
| NAT egress delete | DELETE | `/api/v1/firewall/nat/egress` |
| NAT masquerade list | GET | `/api/v1/firewall/nat/masquerade` |
| NAT masquerade create | POST | `/api/v1/firewall/nat/masquerade` |
| NAT masquerade delete | DELETE | `/api/v1/firewall/nat/masquerade` |
| Group list | GET | `/api/v1/firewall/groups` |
| Group create | POST | `/api/v1/firewall/groups` |
| Group delete | DELETE | `/api/v1/firewall/groups/{name}` |
| Sysctl list | GET | `/api/v1/firewall/sysctl` |
| Sysctl set | POST | `/api/v1/firewall/sysctl` |
| Conntrack settings | GET | `/api/v1/firewall/conntrack/settings` |
| Conntrack set | POST | `/api/v1/firewall/conntrack/settings` |
| Conntrack profiles | GET | `/api/v1/firewall/conntrack/profiles` |
| Conntrack flush | POST | `/api/v1/firewall/conntrack/flush` |

### Network

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| List interfaces | GET | `/api/v1/network/interfaces` |
| List routes | GET | `/api/v1/network/routes` |
| Add route | POST | `/api/v1/network/routes` |
| Delete route | DELETE | `/api/v1/network/routes` |
| List VLANs | GET | `/api/v1/network/vlans` |
| Add VLAN | POST | `/api/v1/network/vlans` |
| Delete VLAN | DELETE | `/api/v1/network/vlans/{id}` |
| DNS config | GET | `/api/v1/network/dns` |
| DNS update | POST | `/api/v1/network/dns` |
| Network throughput | GET | `/api/v1/network/throughput` |

### Traffic

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| Traffic overview | GET | `/api/v1/traffic/overview` |
| Rate limit set | POST | `/api/v1/traffic/ratelimit` |
| Rate limit remove | DELETE | `/api/v1/traffic/ratelimit` |
| Bulk rate limit | POST | `/api/v1/bulk/ratelimit` |
| Shaper restore | POST | `/api/v1/traffic/shaper/restore` |

### PPPoE

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| List interfaces | GET | `/api/v1/pppoe/interfaces` |
| Add interface | POST | `/api/v1/pppoe/interfaces` |
| Remove interface | DELETE | `/api/v1/pppoe/interfaces/{name}` |
| MAC filter list | GET | `/api/v1/pppoe/mac-filter` |
| MAC filter add | POST | `/api/v1/pppoe/mac-filter` |
| MAC filter remove | DELETE | `/api/v1/pppoe/mac-filter/{mac}` |
| PADO delay | GET | `/api/v1/pppoe/pado-delay` |
| PADO delay set | POST | `/api/v1/pppoe/pado-delay` |

### Routing

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| BGP summary | GET | `/api/v1/routing/bgp/summary` |
| BGP neighbors | GET | `/api/v1/routing/bgp/neighbors` |
| BGP routes | GET | `/api/v1/routing/bgp/routes` |
| OSPF neighbors | GET | `/api/v1/routing/ospf/neighbors` |
| OSPF database | GET | `/api/v1/routing/ospf/database` |
| RIP routes | GET | `/api/v1/routing/rip/routes` |
| RIP status | GET | `/api/v1/routing/rip/status` |
| BFD peers | GET | `/api/v1/routing/bfd/peers` |
| BFD summary | GET | `/api/v1/routing/bfd/summary` |

### IP Pool

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| List pools | GET | `/api/v1/ip-pool` |
| Add pool | POST | `/api/v1/ip-pool` |
| Delete pool | DELETE | `/api/v1/ip-pool/{name}` |

### Monitoring

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| Exporter status | GET | `/api/v1/monitoring/status` |
| Configure monitoring | POST | `/api/v1/monitoring/configure` |
| Metrics | GET | `/api/v1/monitoring/metrics` |

### Logs

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| View logs | GET | `/api/v1/logs/journal` |
| Stream logs (SSE) | GET | `/api/v1/logs/stream` |

### System

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| System info | GET | `/api/v1/system/info` |
| System health | GET | `/health` |
| System ready | GET | `/health/ready` |
| System metrics | GET | `/api/v1/system/metrics` |

### DHCP

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| DHCP status | GET | `/api/v1/dhcp/status` |
| DHCP restart | POST | `/api/v1/dhcp/restart` |
| DHCP relay status | GET | `/api/v1/dhcp/relay/status` |
| DHCP relay restart | POST | `/api/v1/dhcp/relay/restart` |

### Diagnostics

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| Zone list | GET | `/api/v1/firewall/zones` |
| Zone create | POST | `/api/v1/firewall/zones` |
| Zone delete | DELETE | `/api/v1/firewall/zones/{name}` |
| Conntrack entries | GET | `/api/v1/diagnostics/conntrack` |
| Conntrack limits | GET | `/api/v1/diagnostics/conntrack/limits` |
| Conntrack flush | POST | `/api/v1/firewall/conntrack/flush` |

### Events

| dawu-manager Action | Method | dawos-agent Endpoint |
|---------------------|--------|---------------------|
| List hooks | GET | `/api/v1/events/hooks` |
| Add hook | POST | `/api/v1/events/hooks` |
| Delete hook | DELETE | `/api/v1/events/hooks/{id}` |
| Fire event | POST | `/api/v1/events/fire` |

---

## Optional Feature Dependencies

Some dawos-agent endpoints require optional packages to be installed on the BNG node:

| Package | Required For |
|---------|-------------|
| dnsmasq | DNS forwarding endpoints |
| keepalived | VRRP failover and restart endpoints |
| FRRouting (FRR) | All routing endpoints (BGP, OSPF, RIP, BFD) |

When an endpoint requires a package that is not installed, dawos-agent returns HTTP 404 or 501. dawu-manager displays a "Feature not available on this node" message in the corresponding dashboard page.

---

## dawos-agent Documentation

For complete dawos-agent API documentation, including request/response schemas and endpoint details, refer to:

- **dawos-agent docs site:** [https://cepat-kilat-teknologi.github.io/dawos-agent/](https://cepat-kilat-teknologi.github.io/dawos-agent/)
- **dawos-agent PyPI:** [https://pypi.org/project/dawos-agent/](https://pypi.org/project/dawos-agent/)
- **dawos-agent GitHub:** [https://github.com/Cepat-Kilat-Teknologi/dawos-agent](https://github.com/Cepat-Kilat-Teknologi/dawos-agent)
