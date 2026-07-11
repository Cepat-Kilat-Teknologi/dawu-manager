# Node feature pages — fix brief (ground truth from live accel-2 production)

All field shapes below are REAL responses captured from a production dawos-agent
(accel-2). Fix the pages to match these shapes. Read `docs/DESIGN.md` first for
the design system (fonts, tokens, skeleton/spinner/toast rules, breakpoints).

## Shared rules for every page

- Keep using `NodePageShell` (loading skeleton / error+retry / empty) and
  `ProxyDataTable` (`ProxyColumn<T>`) — do NOT change their public API.
- Data fetching: `useNodeProxy<T>(nodeId, path, { extract?, refetchInterval? })`.
  `extract` unwraps `{ count, <key>: [...] }` → the array.
- Mutations: `useNodeProxyMutation` (proxy injects the API key server-side —
  NEVER add an API-key field to any resource form; the node's key is already
  used by the proxy).
- Gracefully hide/label sections whose endpoint returns 404/405 instead of
  showing a scary error. A helper: treat `ProxyError.status === 404 || 405` as
  "feature not available on this node" and render a muted note, not an error.
- Every page: skeleton while loading, `content-fade-in` on data, toasts on
  mutation, semantic HTML, works at mobile/tablet/desktop.

## Endpoint shapes (verified)

### network/interfaces → `{ count, interfaces: [...] }`
```
{ name:"ens19", index:2, mac_address:"bc:24:11:1a:85:88", mtu:1500,
  state:"UP", flags:["BROADCAST","MULTICAST","UP","LOWER_UP"],
  addresses:[ { family:"inet"|"inet6", address:"10.0.0.1", prefix_len:24,
               broadcast:null, scope:"global"|"link" } ],
  link_type:"ether" }
```
- BUG: page reads `mac` → must be `mac_address`.
- BUG: page reads `ipv4` → derive: first `addresses[]` with `family==="inet"`,
  render `${address}/${prefix_len}`. Show v6 similarly (muted). No `speed`
  field exists → drop the Speed column (or show link_type).
- `ppp*` interfaces legitimately have `state:"UNKNOWN"` (point-to-point). Render
  UNKNOWN as a neutral (outline) badge, not alarming.

### network/routes → `{ count, routes: [...] }`
```
{ destination:"default", gateway:"192.168.212.225", device:"ens21",
  protocol:"", scope:"", metric:null, source:null }
```
- BUG: page reads `interface` → must be `device`. Empty protocol/metric → "—".

### network/vlans → `{ count, vlans: [...] }`
```
{ name:"", parent:"", vlan_id:0, protocol:"802.1Q", state:"UNKNOWN",
  mac_address:"", mtu:1500, addresses:[] }
```
- These entries are mostly EMPTY junk (name/parent empty, vlan_id 0). FILTER to
  real VLANs: keep only `vlan_id > 0 || name`. Map `vlan_id` → the ID column.
  If none remain → empty state "No VLANs configured." (this node has none).

### network/dns → `{ success, message, config:{ nameservers:[...], search_domains:[...] } }`
- Render `config.nameservers` and `config.search_domains` as labelled lists,
  not the raw success/message/config dump.

### system/info → rich object
```
{ hostname, os, kernel, arch,
  cpu:{...}, memory:{...}, disk:{...},
  interfaces:[ { name, addresses:[...], is_up } ], boot_time }
```
### system/metrics → (poll every 15s)
```
{ cpu:{ count:2, percent:0, load_avg:[0,0,0] },
  memory:{ total_mb:3915, used_mb:277, available_mb:3346, percent:14.5 },
  disk:{ total_gb:21.7, used_gb:5.8, free_gb:16, percent:26.5 },
  timestamp }
```
- REDESIGN system page: CPU / RAM / Disk as gauge/progress cards from
  `system/metrics` (values are NESTED objects — the old flat key/value dump
  breaks on them). Host identity cards (hostname/os/kernel/arch/boot_time +
  computed uptime) from `system/info`. Interfaces list from `system/info.interfaces`.
- `audit/log` → 404 and `ntp/peers` → 404 on this agent: REMOVE those sections.
- Keep `ntp/status` → `{ synced:false, reference, stratum, system_time_offset,
  last_offset, frequency, raw_output }` (render synced badge + fields).
- Keep `lldp/neighbors` → `{ count:0, neighbors:[], raw_output }` (empty is fine).

### routing/{bgp,ospf,rip}/status → `{ configured:false, router_id, local_as,
  neighbors:[], total_prefixes, raw_output }`  (rip: `version, networks[]`)
- `routing/bfd/status` → 404 (REMOVE BFD or show "not available").
- BUG: summary cards show "active" for all because they only check `error`.
  Must read `configured`: `false` → "Not configured" (muted), `true` → "Active"
  (success). When configured, show router_id / AS / neighbor count / prefixes,
  and `raw_output` in a <pre> when present. Much more informative.

### logs/tail → `{ lines:[...], count, source:"accel-ppp" }`
- Support a line-count selector: fetch `logs/tail?lines=N` (100/500/1000/5000).
- Do NOT truncate lines: render each full line with `whitespace-pre-wrap
  break-all` (wrap) OR a horizontally scrollable `<pre>` — user wants full,
  untrimmed lines. Show `source` and line count. Keep the SSE Live Stream toggle.

### ip-pool → `{ count, pools:[] }` (genuinely EMPTY on this node)
### ip-pool/usage → `{ used:"0", total:"253", available:"253" }` (STRINGS)
- Confirmed empty — no named pools. Keep the 3 usage tiles (parse strings to
  numbers). Improve empty copy: "No named IP pools defined. 253 addresses
  available for allocation." Keep Remove mutation for when pools exist.

### pppoe/interfaces → `{ count, interfaces:[ { name:"ens19", options:"" } ] }`
- Only `name` + `options` exist (no state/sessions/mac). REDESIGN: interface
  cards showing name + parsed `options` (split on whitespace into chips), not a
  table with empty State/Sessions/MAC columns.
- `pppoe/pado-delay` → 404 (REMOVE that section).
- `pppoe/mac-filter` → `{ raw_output:"filter type: disabled", count }` → show as
  a status card ("MAC filter: disabled"), not a raw <pre>.

### firewall/rules → `{ raw_output:"table ip accelnat {...}", rules_count:86 }`
- Show the nftables ruleset in a proper code block (JetBrains Mono, full height
  with its own scroll, add a client-side text filter box). rules_count badge.
- `firewall/nat/egress`, `firewall/nat/masquerade`, `firewall/conntrack/config`,
  `firewall/groups` may 404/405 → hide or show "not available on this node"
  (don't render scary errors / "Method Not Allowed" cards).
- `firewall/sysctl` returns `{ success, message, status:"ip_forward: true, ..." }`
  → parse/show key network sysctls.
- NOTE: firewall editing is NOT via the node dialog. The node header "Edit"
  button edits the node CONNECTION (name/url/key). Do not conflate.

## The recurring "edit asks for API key" confusion
The node header "Edit" (EditNodeDialog) edits the node connection and has an
optional API-key field. Users click it expecting to edit the resource on the
page. Resolution: pages get in-context editing where the agent supports it
(config inline editor is being added separately). Elsewhere, keep resource
views informative; never add an API-key input to a resource form.
