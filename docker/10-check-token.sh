#!/bin/sh
set -eu
case "${AQEF_ADMIN_TOKEN:-}" in
  ''|*[!A-Za-z0-9._-]*) echo 'AQEF_ADMIN_TOKEN must contain only letters, digits, dots, underscores and hyphens' >&2; exit 1;;
esac
