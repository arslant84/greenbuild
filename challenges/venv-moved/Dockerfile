FROM python:3.13-alpine

# The company's report service, built into a wheel the way the release pipeline ships it; the sandbox has
# no network, so this wheel directory is the only place to install it from.
RUN mkdir -p /tmp/acme/acme_reports \
    && printf 'import sys\nfrom http.server import BaseHTTPRequestHandler, HTTPServer\n\n\nclass Handler(BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200)\n        self.end_headers()\n        self.wfile.write(f"acme-reports 2.3.0 {self.path}\\n".encode())\n\n    def log_message(self, *args):\n        pass\n\n\ndef serve():\n    HTTPServer(("127.0.0.1", int(sys.argv[sys.argv.index("--port") + 1])), Handler).serve_forever()\n' > /tmp/acme/acme_reports/__init__.py \
    && printf '[project]\nname = "acme-reports"\nversion = "2.3.0"\n\n[project.scripts]\nacme-reports = "acme_reports:serve"\n\n[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n' > /tmp/acme/pyproject.toml \
    && pip wheel --quiet --no-deps --wheel-dir /opt/wheels /tmp/acme \
    && rm -rf /tmp/acme /root/.cache

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
