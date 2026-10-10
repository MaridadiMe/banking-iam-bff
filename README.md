# Native Mobile Banking Authentication Gateway (BFF)

An enterprise-grade, financial-grade API (FAPI) aligned **Backend-for-Frontend (BFF)** built with **NestJS**. This gateway decouples traditional web-based OpenID Connect (OIDC) redirect flows into a **purely API-driven, redirect-free cryptographic handshake architecture** optimized for native mobile banking applications (e.g., Flutter, Native iOS/Android).

This project is tailored for strict compliance with central banking frameworks, such as the **Bank of Tanzania (BoT) data regulations**, by ensuring that **plaintext user PINs and raw biometric data never cross the network or enter server logs.**

## 🚀 Key Architectural Features

- **Zero-Knowledge PIN Verification:** The 4-digit PIN never leaves the mobile handset. The app uses the PIN locally to derive an Argon2id key, decrypt an on-device private key, and sign a server challenge.
- **Hardware-Bound Biometric Logins:** Implements dual asymmetric keypairs (PIN-bound and hardware-isolated Biometric-bound keys) matching separate cryptographic endpoints.
- **Anti-DoS Account Lockout:** Tracks failed logins against an isolated composite key (`auth_fail:{username}:{device_id}`) in Redis. This stops malicious actors from executing broad Denial of Service (DoS) attacks to lock out random users out of all channels (Web, USSD, Agents).
- **Headless IAM Wrap:** Integrates seamlessly over a secure mTLS backchannel into open-source Identity and Access Management (IAM) platforms like **Keycloak** or **WSO2 Identity Server**.

## 📐 The Cryptographic Handshake Flow

```unset
[ Flutter App (Secure Enclave) ]             [ NestJS Backend-BFF ]            [ Keycloak / WSO2 ]
              │                                        │                               │
 1. Request /auth/challenge ──────────────────────────►│                               │
 2. Returns Nonce/Challenge ◄──────────────────────────┤                               │
              │                                        │                               │
 3. Signs Challenge with Private Key                   │                               │
 4. Sends Signature + Device ID ──────────────────────►│                               │
              │                                        │ 5. Fetch Public Key           │
              │                                        │    From Profile Attributes ──►│
              │                                        │ 6. Cryptographically Verify   │
              │                                        │    Device Hardware Signature  │
              │                                        │                               │
              │                                        │ 7. Exchange for OIDC Tokens ──► [ Issue JWTs ]
              │◄───────────────────────────────────────┤                               │
```

## 📦 Tech Stack & Core Infrastructure

- **Framework:** NestJS (TypeScript)
- **Stateful Store/Cache:** Redis (Failure tracking, rate limiting, and challenge management)
- **Identity Provider Integration:** Keycloak / WSO2 IS (via Admin REST APIs)
- **Cryptographic Standard:** Ed25519 / ECDSA (secp256r1)

## 🔧 Installation & Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/your-repo/mobile-banking-auth-bff
cd mobile-banking-auth-bff
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development

# Redis Infrastructure
REDIS_HOST=localhost
REDIS_PORT=6379

# IAM Engine Config (Keycloak)
KEYCLOAK_BASE_URL=https://yourbank.co.tz
KEYCLOAK_REALM=retail-banking
KEYCLOAK_CLIENT_ID=mobile-bff-proxy
KEYCLOAK_CLIENT_SECRET=your_super_secure_client_secret_string

# Security Hardening
MAX_AUTH_ATTEMPTS=3
LOCKOUT_DURATION_SECONDS=900 # 15 Minutes
CHALLENGE_TTL_SECONDS=60
```

### 3. Spin Up Infrastructure Locally

Use the bundled docker-compose setup to orchestrate local development containers for Keycloak and Redis:

```bash
docker-compose up -d
```

### 4. Start the NestJS Gateway

```bash
# development mode
npm run start

# watch mode
npm run start:dev

# production compilation & running
npm run build
node dist/main
```

## 🛣️ API Endpoints Specification

### 1. Request Authentication Challenge

Generates a cryptographically strong, short-lived nonce bound to a user context to mitigate replay attacks.

- **URL:** `/api/v1/auth/challenge`
- **Method:** `GET`
- **Query Parameters:** `username=+255712345678`
- **Success Response (200 OK):**

```json
{
  "status": "SUCCESS",
  "challenge": "7f8a3c9b2e1f4d6a8c0b5e9f3a1b7c5e",
  "expires_in_seconds": 60
}
```

### 2. Login via PIN (Device Signature + Knowledge Proof)

Validates the physical phone's identity via cryptographic signature verification before executing identity resolution loops.

- **URL:** `/api/v1/auth/login-pin`
- **Method:** `POST`
- **Payload:**

```json
{
  "device_id": "c19b28a4-098e-4f76-81c1-236bfa6b9861",
  "username": "+255712345678",
  "challenge": "7f8a3c9b2e1f4d6a8c0b5e9f3a1b7c5e",
  "signature": "MEQCIDU3V...base64_encoded_hardware_signature..."
}
```

- **Success Response (200 OK):** Returns standardized secure OIDC standard JWTs.

### 3. Login via Biometrics (Device Signature + Inherence Proof)

Processes high-speed biometric logins. Requires signature blocks extracted from keys structurally protected inside the mobile Secure Enclave.

- **URL:** `/api/v1/auth/login-biometric`
- **Method:** `POST`
- **Payload:**

```json
{
  "device_id": "c19b28a4-098e-4f76-81c1-236bfa6b9861",
  "username": "+255712345678",
  "challenge": "7f8a3c9b2e1f4d6a8c0b5e9f3a1b7c5e",
  "signature": "3045022100e4b8a...base64_biometric_hardware_signature..."
}
```

## 🛑 Security Status Codes & Error Responses

The gateway implements discrete HTTP statuses to manage the client-side state machine natively within the Flutter app UI layout.

### 401 Unauthorized (Credential Mismatch / Remaining Attempts)

Returned when a signature validation fails, signaling a bad PIN entry locally or a bad signature block.

```json
{
  "status": "FAILED",
  "error_code": "INVALID_SIGNATURE",
  "message": "Uthibitisho umeshindwa. Umebakiza nafasi 2 za kujaribu.",
  "remaining_attempts": 2
}
```

### 423 Locked (Localized Brute-Force Lockout Engaged)

Returned when the device/user boundary crosses the maximum threshold limits (3 failed validation cycles).

```json
{
  "status": "LOCKED",
  "error_code": "DEVICE_LOCKOUT",
  "message": "Umekosea mara 3. Akaunti yako imefungwa kwa usalama kwa dakika 15. Jaribu tena baadaye au wasiliana na huduma kwa wateja.",
  "lockout_expiry": "2026-10-11T00:57:11.000Z"
}
```

## 🤝 Contributing

We welcome open-source contributions from engineering teams across the global and East African fintech ecosystems! Please follow these guidelines:

1.  Fork the repository.
2.  Create a structured feature branch (`git checkout -b feature/amazing-security-fix`).
3.  Ensure 100% unit test coverage for any cryptographic operations or interceptors.
4.  Open a Pull Request describing your implementation details.

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more details.
