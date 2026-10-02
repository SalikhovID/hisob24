#!/usr/bin/env python3
"""Points the host nginx's hisob24.uz sites at the hisob24-v2 stack.

  app.hisob24.uz   → web   127.0.0.1:8092
  admin.hisob24.uz → admin 127.0.0.1:8091
  api.hisob24.uz   → api   127.0.0.1:8090, only /webhooks/ and /healthz

Only the HTTPS server block's locations change; the certbot-managed lines
stay as they are. Run as root on the server, then: nginx -t && systemctl
reload nginx.
"""
import os
import re
import sys

SITES = os.environ.get("NGINX_SITES", "/etc/nginx/sites-available")

PROXY = """
        proxy_pass http://127.0.0.1:{port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "keep-alive";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;"""

LOCATIONS = {
    "app.hisob24.uz": "    location / {%s\n    }\n" % PROXY.format(port=8092),
    "admin.hisob24.uz": "    location / {%s\n    }\n" % PROXY.format(port=8091),
    # Browsers reach the API through the apps' /api rewrite; only Telegram's
    # webhooks and the health check need the public domain.
    "api.hisob24.uz": (
        "    location /webhooks/ {%s\n    }\n" % PROXY.format(port=8090)
        + "    location = /healthz {%s\n    }\n" % PROXY.format(port=8090)
        + "    location / {\n        return 404;\n    }\n"
    ),
}


HEADER = (
    "# Hisob24 (/var/www/hisob24-v2, docker-compose.prod.yml): nginx terminates TLS;\n"
    "# app → web 127.0.0.1:8092, admin → 127.0.0.1:8091, api → 127.0.0.1:8090.\n"
)

# admin.hisob24.uz.conf is first in sites-enabled, so its first block is the
# default HTTPS server: unknown hosts keep going to the user app, as before.
CATCH_ALL = """# Default HTTPS server (this file is first in sites-enabled): unknown hosts go
# to the user app.
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name _;
    ssl_certificate /etc/letsencrypt/live/app.hisob24.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.hisob24.uz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    return 301 https://app.hisob24.uz$request_uri;
}

"""


def switch(domain: str, locations: str) -> None:
    path = f"{SITES}/{domain}.conf"
    text = open(path).read()
    # Leading comments describe the old stack: replace them.
    text = re.sub(r"\A(?:#[^\n]*\n)*", "", text)
    text = HEADER + (CATCH_ALL if domain == "admin.hisob24.uz" else "") + text
    # The first server block is the HTTPS one: from its server_name line to
    # the first certbot "listen" line, replace whatever locations it has.
    head = re.search(r"server \{\n\s*server_name %s;\n" % re.escape(domain), text)
    listen = re.compile(r"\n\s*listen \[::\]:443 ssl").search(text, head.end()) if head else None
    if not head or not listen:
        sys.exit(f"{path}: unexpected layout, nothing changed")
    new = text[: head.end()] + "    client_max_body_size 20m;\n" + locations + text[listen.start() + 1 :]
    open(path, "w").write(new)
    print(f"{domain}: switched")


if __name__ == "__main__":
    for domain, locations in LOCATIONS.items():
        switch(domain, locations)
