#!/usr/bin/env bash
# Collect system metrics (CPU, memory, network) and insert into system_metrics table.
# Intended to run as a cron job every minute:
#   * * * * * /home/ubuntu/app/scripts/collect_metrics.sh

set -euo pipefail

DB_HOST="127.0.0.1"
DB_PORT="54322"
DB_USER="postgres"
DB_NAME="postgres"
STATE_FILE="/tmp/collect_metrics_net.state"
NET_IFACE="${TSRM_NET_IFACE:-enp0s6}"

# --- CPU usage (%) from /proc/stat snapshot over 1 second ---
read_cpu() {
  awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8, $2+$3+$4+$6+$7+$8}' /proc/stat
}

cpu_before=$(read_cpu)
sleep 1
cpu_after=$(read_cpu)

cpu_pct=$(awk -v before="$cpu_before" -v after="$cpu_after" 'BEGIN {
  split(before, b); split(after, a)
  total = (a[1] - b[1])
  busy  = (a[2] - b[2])
  if (total > 0) printf "%.1f", busy / total * 100
  else print "0.0"
}')

# --- Memory usage (%) from free ---
mem_pct=$(free | awk '/^Mem:/ { printf "%.1f", ($2 - $7) / $2 * 100 }')

# --- Network delta (MB) since last run ---
rx_bytes=$(awk -v iface="$NET_IFACE:" '$1 == iface {print $2}' /proc/net/dev)
tx_bytes=$(awk -v iface="$NET_IFACE:" '$1 == iface {print $10}' /proc/net/dev)

net_rx_mb="0"
net_tx_mb="0"

if [[ -f "$STATE_FILE" ]]; then
  prev_rx=$(awk 'NR==1' "$STATE_FILE")
  prev_tx=$(awk 'NR==2' "$STATE_FILE")
  net_rx_mb=$(awk -v cur="$rx_bytes" -v prev="$prev_rx" 'BEGIN { printf "%.3f", (cur - prev) / 1048576 }')
  net_tx_mb=$(awk -v cur="$tx_bytes" -v prev="$prev_tx" 'BEGIN { printf "%.3f", (cur - prev) / 1048576 }')

  # Guard against negative values (reboot / counter reset)
  if awk -v v="$net_rx_mb" 'BEGIN { exit !(v < 0) }'; then net_rx_mb="0"; fi
  if awk -v v="$net_tx_mb" 'BEGIN { exit !(v < 0) }'; then net_tx_mb="0"; fi
fi

printf '%s\n%s\n' "$rx_bytes" "$tx_bytes" > "$STATE_FILE"

# --- Insert into database ---
PGPASSWORD=postgres psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -c \
  "INSERT INTO system_metrics (cpu_pct, mem_pct, net_rx_mb, net_tx_mb) VALUES ($cpu_pct, $mem_pct, $net_rx_mb, $net_tx_mb);"

# --- Cleanup old data (run once per invocation, fast no-op if nothing to delete) ---
PGPASSWORD=postgres psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -c \
  "SELECT cleanup_system_metrics();" > /dev/null 2>&1 || true
