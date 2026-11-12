#!/usr/bin/env bash
TMP="${TMPDIR:-/tmp}/phoenix-verify"
for f in postgrest gateway next; do [ -f "$TMP/$f.pid" ] && kill "$(cat "$TMP/$f.pid")" 2>/dev/null; rm -f "$TMP/$f.pid"; done
sleep 1; exit 0
