# Usługa renderująca Wykrojnika: Python z modułem bpy (Blender bez okna) i serwer z biblioteki standardowej.
FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libegl1 libglx-mesa0 libgl1-mesa-dri libxrender1 libxi6 libxkbcommon0 libsm6 libice6 libxfixes3 libxxf86vm1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir bpy
WORKDIR /app
COPY serwer.py wykrojnik_render.py ./
RUN useradd -m render && mkdir -p /dane && chown render /dane
USER render
ENV WK_PORT=8080 WK_DATA=/dane
EXPOSE 8080
CMD ["python3", "serwer.py"]
