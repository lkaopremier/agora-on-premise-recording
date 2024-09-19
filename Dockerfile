# Utiliser une image de base Ubuntu
FROM ubuntu:latest

# Mettre à jour et installer les paquets requis
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    gcc \
    git \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Télécharger et décompresser le SDK Agora Recording pour Linux
ADD https://download.agora.io/ardsdk/release/Agora_Recording_SDK_for_Linux_v2_3_4_FULL.tar.gz /tmp/
RUN tar -xzf /tmp/Agora_Recording_SDK_for_Linux_v2_3_4_FULL.tar.gz -C /tmp/ && \
    mv /tmp/Agora_Recording_SDK_for_Linux_FULL /opt/agora_recorder && \
    rm /tmp/Agora_Recording_SDK_for_Linux_v2_3_4_FULL.tar.gz

# Définir le répertoire de travail pour le SDK et compiler
WORKDIR /opt/agora_recorder/samples/cpp
RUN make
RUN ln -s /opt/agora_recorder/samples/cpp/recorder_local /usr/local/bin/recorder

# Définir le répertoire de travail pour l'application Node.js
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Exposer les ports requis pour la communication avec les serveurs Agora et l'API Express
EXPOSE 4000/udp
EXPOSE 41000/udp
EXPOSE 1080/tcp
EXPOSE 8000/tcp
EXPOSE 4001-4030/udp
EXPOSE 1080/udp
EXPOSE 8000/udp
EXPOSE 9700/udp
EXPOSE 25000/udp
EXPOSE 3000

VOLUME ./output


# Définir le point d'entrée du conteneur
CMD ["node", "server.js"]