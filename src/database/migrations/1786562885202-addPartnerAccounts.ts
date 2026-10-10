import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 3.5 — Partner Settlement Accounts. Adds PARTNER_ACCOUNTS as a
// child of PARTNERS, and a partnerAccountId FK on TRANSFERS so every
// transfer is traceable to the settlement account it was posted against.
// Hand-authored to mirror InitialDatabaseSetup1786562882202 — see its
// header comment for context (no live Oracle instance available to
// generate this via the CLI; regenerate/diff before running in production).
export class AddPartnerAccounts1786562885202 implements MigrationInterface {
  name = 'AddPartnerAccounts1786562885202';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "PARTNER_ACCOUNTS" ("id" varchar2(36), "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL, "createdBy" varchar2(255), "updatedBy" varchar2(255), "partnerId" varchar2(36) NOT NULL, "accountNumber" varchar2(255) NOT NULL, "currency" varchar2(3) NOT NULL, "isDefault" number DEFAULT 0 NOT NULL, "status" varchar2(20) DEFAULT 'ACTIVE' NOT NULL, CONSTRAINT "PK_PARTNER_ACCOUNTS" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "PARTNER_ACCOUNTS" ADD CONSTRAINT "FK_PARTNER_ACCOUNTS_PARTNER" FOREIGN KEY ("partnerId") REFERENCES "PARTNERS" ("id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "TRANSFERS" ADD "partnerAccountId" varchar2(36) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "TRANSFERS" ADD CONSTRAINT "FK_TRANSFERS_PARTNER_ACCOUNT" FOREIGN KEY ("partnerAccountId") REFERENCES "PARTNER_ACCOUNTS" ("id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "TRANSFERS" DROP CONSTRAINT "FK_TRANSFERS_PARTNER_ACCOUNT"`,
    );
    await queryRunner.query(
      `ALTER TABLE "TRANSFERS" DROP COLUMN "partnerAccountId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "PARTNER_ACCOUNTS" DROP CONSTRAINT "FK_PARTNER_ACCOUNTS_PARTNER"`,
    );
    await queryRunner.query(`DROP TABLE "PARTNER_ACCOUNTS"`);
  }
}
