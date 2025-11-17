FROM gradle:8-jdk21-alpine AS builder
WORKDIR /app
COPY settings.gradle .
COPY build.gradle .
RUN gradle dependencies --no-daemon
COPY src src
RUN gradle clean bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]

