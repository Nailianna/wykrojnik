# Wykrojnik w jednym kontenerze: strona, usługa renderująca z Blenderem (moduł bpy, bez okna) i pośrednik do Claude'a.
FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libegl1 libx11-6 libxext6 libxrender1 libxi6 libxfixes3 libxkbcommon0 libsm6 libice6 libxxf86vm1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir bpy==5.3.0
WORKDIR /app
COPY server/serwer.py server/wykrojnik_render.py ./
COPY index.html app.js cloth.js engine.js figure.js font.js importer.js prints.js ./strona/
COPY vendor ./strona/vendor
RUN useradd -m render && mkdir -p /dane && chown render /dane
USER render
# Na serwerze bez karty graficznej Cycles jest wielokrotnie szybszy od EEVEE.
ENV WK_DATA=/dane WK_STATIC=/app/strona WK_ENGINE=CYCLES
EXPOSE 8080
CMD ["python3", "serwer.py"]
