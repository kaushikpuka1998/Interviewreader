# Build the Spring Boot jar, then run it with the Tectonic LaTeX engine (free, open source) installed.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
ARG TECTONIC_VERSION=0.17.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl fontconfig fonts-dejavu-core \
 && curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    | tar -xz -C /usr/local/bin tectonic \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
# Tectonic caches the LaTeX packages it downloads. The cache is built into the image so the first
# compile after a deploy doesn't have to download them (that download took minutes).
ENV TECTONIC_PATH=/usr/local/bin/tectonic XDG_CACHE_HOME=/opt/tex-cache
COPY docker/tex-warmup.tex /tmp/tex-warmup.tex
RUN mkdir -p /opt/tex-cache && cd /tmp && /usr/local/bin/tectonic -X compile tex-warmup.tex && rm -f /tmp/tex-warmup.*
COPY --from=build /app/target/backend-*.jar /app/app.jar
EXPOSE 8080
# Headless: share cards (LinkedIn preview pictures) are drawn with Java2D, which needs no display, only fonts.
ENTRYPOINT ["java", "-Djava.awt.headless=true", "-jar", "/app/app.jar"]
