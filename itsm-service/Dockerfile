# Spotlight ITSM service: build with Maven, run on a small JRE image.
# Sized for a 512 MB host (Render free): heap capped at 350 MB, serial GC.

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
# The unit tests need no database and take about a second, so the image only builds if they pass.
RUN mvn -q -B package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/itsm-service-*.jar app.jar
ENV JAVA_OPTS="-Xmx350m -Xss512k -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m"
# Render sets PORT; application.yml reads it and falls back to 8081.
EXPOSE 8081
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
