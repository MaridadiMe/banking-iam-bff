import { MigrationInterface, QueryRunner } from 'typeorm';

// Hand-authored to mirror what `npm run migration:generate` would produce
// from the Phase 2-6 entities, since no live Oracle instance was available
// to generate it directly. Regenerate/diff against a real Oracle instance
// before running in production (see README "Open Questions").
export class InitialDatabaseSetup1786562882202 implements MigrationInterface {
  name = 'InitialDatabaseSetup1786562882202';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "PARTNERS" ("id" varchar2(36), "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "createdBy" varchar2(255), "updatedBy" varchar2(255), "partnerCode" varchar2(255) NOT NULL, "partnerName" varchar2(255) NOT NULL, "gatewayClientId" varchar2(255) NOT NULL, "callbackUrl" varchar2(500), "isActive" number DEFAULT 1 NOT NULL, "deactivationReason" varchar2(500), "dailyLimit" number(18,2), "perTransactionLimit" number(18,2), "contactEmail" varchar2(255) NOT NULL, CONSTRAINT "PK_PARTNERS" PRIMARY KEY ("id"), CONSTRAINT "UQ_PARTNERS_CODE" UNIQUE ("partnerCode"), CONSTRAINT "UQ_PARTNERS_CLIENT_ID" UNIQUE ("gatewayClientId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "FSPS" ("id" varchar2(36), "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "createdBy" varchar2(255), "updatedBy" varchar2(255), "fspCode" varchar2(20) NOT NULL, "fspName" varchar2(255) NOT NULL, "fspType" varchar2(20) NOT NULL, "country" varchar2(100), "isActive" number DEFAULT 1 NOT NULL, "supportsAccountLookup" number DEFAULT 0 NOT NULL, "routingChannel" varchar2(20) NOT NULL, "deactivationReason" varchar2(500), CONSTRAINT "PK_FSPS" PRIMARY KEY ("id"), CONSTRAINT "UQ_FSPS_CODE" UNIQUE ("fspCode"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "TRANSFERS" ("id" varchar2(36), "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "createdBy" varchar2(255), "updatedBy" varchar2(255), "partnerId" varchar2(36) NOT NULL, "partnerReference" varchar2(255) NOT NULL, "transactionId" varchar2(255) NOT NULL, "senderName" varchar2(255) NOT NULL, "senderCountry" varchar2(100) NOT NULL, "senderIdentifier" varchar2(255) NOT NULL, "beneficiaryFspCode" varchar2(20) NOT NULL, "beneficiaryAccountIdentifier" varchar2(255) NOT NULL, "beneficiaryName" varchar2(255) NOT NULL, "amount" number(18,2) NOT NULL, "currency" varchar2(3) NOT NULL, "purposeCode" varchar2(50) NOT NULL, "routingChannel" varchar2(20) NOT NULL, "status" varchar2(20) DEFAULT 'PENDING' NOT NULL, "cbsReference" varchar2(255), "tipsReference" varchar2(255), "failureReason" varchar2(500), CONSTRAINT "PK_TRANSFERS" PRIMARY KEY ("id"), CONSTRAINT "UQ_TRANSFERS_PARTNER_REF" UNIQUE ("partnerReference"), CONSTRAINT "UQ_TRANSFERS_TXN_ID" UNIQUE ("transactionId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ACCOUNT_LOOKUP_LOGS" ("id" varchar2(36), "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "createdBy" varchar2(255), "updatedBy" varchar2(255), "partnerId" varchar2(36) NOT NULL, "fspCode" varchar2(20) NOT NULL, "routingChannelUsed" varchar2(20) NOT NULL, "accountIdentifier" varchar2(255) NOT NULL, "accountName" varchar2(255), "currency" varchar2(3), "lookupStatus" varchar2(10) NOT NULL, "failureReason" varchar2(500), "expiresAt" timestamp NOT NULL, "consumedAt" timestamp, "consumedByTransferId" varchar2(36), CONSTRAINT "PK_ACCOUNT_LOOKUP_LOGS" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "CONFIGURATIONS" ("id" varchar2(36), "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "createdBy" varchar2(255), "updatedBy" varchar2(255), "key" varchar2(255) NOT NULL, "value" clob NOT NULL, CONSTRAINT "PK_CONFIGURATIONS" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "TRANSFERS" ADD CONSTRAINT "FK_TRANSFERS_PARTNER" FOREIGN KEY ("partnerId") REFERENCES "PARTNERS" ("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ACCOUNT_LOOKUP_LOGS" ADD CONSTRAINT "FK_ALL_PARTNER" FOREIGN KEY ("partnerId") REFERENCES "PARTNERS" ("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ACCOUNT_LOOKUP_LOGS" ADD CONSTRAINT "FK_ALL_TRANSFER" FOREIGN KEY ("consumedByTransferId") REFERENCES "TRANSFERS" ("id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ACCOUNT_LOOKUP_LOGS" DROP CONSTRAINT "FK_ALL_TRANSFER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ACCOUNT_LOOKUP_LOGS" DROP CONSTRAINT "FK_ALL_PARTNER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "TRANSFERS" DROP CONSTRAINT "FK_TRANSFERS_PARTNER"`,
    );
    await queryRunner.query(`DROP TABLE "CONFIGURATIONS"`);
    await queryRunner.query(`DROP TABLE "ACCOUNT_LOOKUP_LOGS"`);
    await queryRunner.query(`DROP TABLE "TRANSFERS"`);
    await queryRunner.query(`DROP TABLE "FSPS"`);
    await queryRunner.query(`DROP TABLE "PARTNERS"`);
  }
}
