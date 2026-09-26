-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "description" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "stripe_customer_id" TEXT,
    "metadata" JSONB,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "provider_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processing_status" "WebhookProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_stripe_checkout_session_id_key" ON "payment_transactions"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_stripe_payment_intent_id_key" ON "payment_transactions"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "payment_transactions_user_id_created_at_idx" ON "payment_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_status_created_at_idx" ON "payment_transactions"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_reference_type_reference_id_idx" ON "payment_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_provider_created_at_idx" ON "payment_webhook_events"("provider", "created_at");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processing_status_created_at_idx" ON "payment_webhook_events"("processing_status", "created_at");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
