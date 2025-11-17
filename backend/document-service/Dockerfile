FROM gradle:8-jdk21-alpine AS builder
WORKDIR /app
COPY settings.gradle build.gradle ./
COPY src src
RUN gradle clean bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8040
ENTRYPOINT ["java", "-jar", "app.jar"]

