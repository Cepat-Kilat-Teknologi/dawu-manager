# dawos-agent API coverage & CRUD buildout spec

Source of truth: live OpenAPI from accel-2 (`GET http://<node>:8471/openapi.json`).
**150 endpoints / 30 modules / 67 write endpoints.** All request schemas below are
verbatim from that spec — build forms to match exactly.

## SAFETY (read before building write features)
accel-2 is a PRODUCTION BNG with real subscribers. Build + unit-test writes, verify
read flows in-browser, but DO NOT fire destructive writes (config apply, session
terminate, service restart, firewall save, route/vlan add/delete, pool delete)
against it. Verify request payload shape against these schemas; leave live write
testing to the user on a dev node / maintenance window.

## Data-shape truths (verified against accel-2)
- Interfaces: `state:"UNKNOWN"` for ppp is misleading — ppp carries
  `flags:["POINTOPOINT","UP","LOWER_UP"]`. Derive display state: UNKNOWN + flags
  include UP/LOWER_UP → "UP"; no UP flag → "DOWN"; else keep raw.
- sessions/stats → `{active, starting, finishing, cpu_percent:"0", pool_used:"0",
  pool_total:"253", uptime}` (strings). pool_used=0 is CORRECT — subscriber IPs
  come from RADIUS (Framed-IP), not the local accel-ppp ippool. Label clearly.
- logs/tail → `?lines=N&unit=<systemd-unit>`. Default unit accel-ppp has only ~2
  journald lines (accel-ppp logs to /var/log/accel-ppp/accel-ppp.log, NOT journald).
  Add a `unit` selector + note this limitation; `lines` is honoured but capped by
  what journald has.
- ntp/status → `{synced:false, reference:"", stratum:0, ...all empty}` when not
  synced. Present as "Not synced" + dash empty fields (don't render blanks).
- traffic/ratelimit (GET) → 404; traffic/queue/stats (GET) → 404 "No live session".
  There is NO list endpoint. Per-user override is `POST/DELETE traffic/ratelimit/{username}`.
- monitoring/metrics → 404 when node_exporter inactive (monitoring/status shows
  exporter states). Guidance: "Metrics need node_exporter — currently inactive;
  start it above." config has NO validate endpoint (only diff/compare GET + the
  guard-timer on apply). firewall HAS `POST firewall/validate`.

## Write-endpoint request schemas (build forms to match)

### network
- `POST network/routes` — `{destination:string, gateway:string, device?:string, metric?:int>=0}`
- `DELETE network/routes` — `{destination:string, gateway?:string}`
- `POST network/vlans` — `{parent:string, vlan_id:int, address?:string}`
- `DELETE network/vlans/{name}` ; `PUT network/vlans/{name}`
- `PUT network/interfaces/{name}` ; `PUT network/dns`

### pppoe
- `POST pppoe/interfaces` — `{interface:string, options:string}`
- `DELETE pppoe/interfaces/{name}`
- `POST pppoe/mac-filter` — `{mac:string}`
- `DELETE pppoe/mac-filter/{mac}`
- `PUT pppoe/pado` (pado-delay)

### ip-pool
- `POST ip-pool` — `{name:string, ip_range:string}`  (ip_range CIDR e.g. 10.0.0.0/24)
- `DELETE ip-pool/{name}`  (already wired)

### firewall
- `POST firewall/validate` — empty body; validates pending ruleset. Add before Save.
- `POST firewall/save` (wired) ; `POST firewall/groups {name,type,...}` ;
  `DELETE firewall/groups/{name}` ; `POST firewall/nat/egress` ;
  `DELETE firewall/nat/egress/{customer_ip}` ; `POST firewall/nat/masquerade` ;
  `PUT firewall/sysctl` ; `PUT firewall/conntrack`

### config
- `POST config/apply` — `{content:string, confirm_minutes:int}` (wired; guard timer)
- `GET config/diff?backup_name=` ; `GET config/compare?from_name=&to_name=`
- No validate endpoint — surface the guard-timer as the "test", add a client INI
  sanity lint (balanced [sections], no tab-indent errors), and a diff preview.

### traffic
- `POST traffic/ratelimit/{username}` — `{rate:string}` (e.g. "5M/20M")
- `DELETE traffic/ratelimit/{username}`

### dns / dhcp / limits / scheduler / zones / vrrp / conntrack / events / bulk
- `PUT dns/forwarding/config {servers:[], cache_size:int}` ; `POST dns/forwarding/flush`
- `POST dhcp/restart` (wired) ; `POST dhcp/relay/restart`  (no dhcp config PUT exists)
- `PUT limits {...}` ; scheduler POST/DELETE/run ; `POST zones {...}` `DELETE zones/{zone}`
- `POST vrrp/failover` `POST vrrp/restart` ; conntrack profiles/table-size/timeouts
- `POST events/hooks` `DELETE events/hooks/{name}` `POST events/fire` (wired)
- `POST bulk/terminate|ratelimit|shaper-restore`

## Coverage gap (write ops NOT yet in the UI) — CRUD to add
network routes/vlans/interfaces/dns · pppoe interfaces/mac-filter/pado · ip-pool add
· firewall validate/groups/nat/sysctl/conntrack · config diff/compare · traffic
per-user ratelimit · dns forwarding config/flush · limits · scheduler · zones · vrrp
· conntrack tuning · events hooks · bulk ops.

Priority (user-named): firewall validate, config diff/guard, pppoe add-interface +
mac-filter, network route + vlan CRUD, ip-pool add, traffic per-user ratelimit.
