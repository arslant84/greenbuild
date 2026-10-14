FROM python:3.13-alpine

# The company's invoice library, built into a wheel the way the release pipeline ships it; the sandbox has
# no network, so this wheel directory is the only place to install it from.
RUN mkdir -p /tmp/acme/acme_invoice \
    && printf 'def render(order):\n    return f"ACME invoice INV-{order:06d}: total {order * 7 %% 1000}.{order %% 100:02d} EUR"\n' > /tmp/acme/acme_invoice/__init__.py \
    && printf '[project]\nname = "acme-invoice"\nversion = "1.2.0"\n\n[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n' > /tmp/acme/pyproject.toml \
    && pip wheel --quiet --no-deps --wheel-dir /opt/wheels /tmp/acme \
    && rm -rf /tmp/acme /root/.cache

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
