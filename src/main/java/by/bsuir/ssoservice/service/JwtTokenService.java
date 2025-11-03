package by.bsuir.ssoservice.service;

import by.bsuir.ssoservice.model.enums.UserRole;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.KeyPair;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Сервис для генерации и валидации JWT токенов
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JwtTokenService {

    private final KeyPair keyPair;

    private static final long ACCESS_TOKEN_VALIDITY = 15 * 60;
    private static final long REFRESH_TOKEN_VALIDITY = 7 * 24 * 60 * 60;

    public String generateAccessToken(UUID userId, String email, UserRole role) {
        try {
            Instant now = Instant.now();

            JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                    .subject(userId.toString())
                    .claim("email", email)
                    .claim("role", role.name())
                    .issuer("http://localhost:7777")
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plusSeconds(ACCESS_TOKEN_VALIDITY)))
                    .jwtID(UUID.randomUUID().toString())
                    .build();

            SignedJWT signedJWT = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.RS256)
                            .keyID("sso-key-id")
                            .build(),
                    claimsSet
            );

            JWSSigner signer = new RSASSASigner((RSAPrivateKey) keyPair.getPrivate());
            signedJWT.sign(signer);

            return signedJWT.serialize();
        } catch (JOSEException e) {
            log.error("Error generating access token", e);
            throw new RuntimeException("Failed to generate access token", e);
        }
    }

    public String generateRefreshToken() {
        return UUID.randomUUID().toString();
    }

    public boolean validateAccessToken(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            JWSVerifier verifier = new RSASSAVerifier((RSAPublicKey) keyPair.getPublic());

            if (!signedJWT.verify(verifier)) {
                return false;
            }

            Date expirationTime = signedJWT.getJWTClaimsSet().getExpirationTime();
            return expirationTime != null && expirationTime.after(new Date());
        } catch (Exception e) {
            log.error("Error validating access token", e);
            return false;
        }
    }

    public UUID getUserIdFromToken(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            return UUID.fromString(signedJWT.getJWTClaimsSet().getSubject());
        } catch (Exception e) {
            log.error("Error extracting userId from token", e);
            return null;
        }
    }

    public long getAccessTokenValidity() {
        return ACCESS_TOKEN_VALIDITY;
    }

    public long getRefreshTokenValidity() {
        return REFRESH_TOKEN_VALIDITY;
    }
}
