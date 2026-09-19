FROM maven:3.9.12-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src src
RUN mvn -B -ntp package -DskipTests
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd -r campus && useradd -r -g campus campus && mkdir -p /app/uploads && chown -R campus:campus /app
COPY --from=build --chown=campus:campus /build/target/api-0.1.0.jar /app/app.jar
USER campus
ENV UPLOAD_ROOT=/app/uploads
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
