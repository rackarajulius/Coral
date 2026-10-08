-- CreateTable
CREATE TABLE "marketplace_requests" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "service_listing_id" TEXT,
    "project_brief_id" TEXT,
    "requester_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "requester_company_id" TEXT,
    "recipient_company_id" TEXT,
    "body" TEXT NOT NULL,
    "work_samples" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "post_id" TEXT,
    "accepted_at" TIMESTAMP(3),
    "first_recipient_reply_at" TIMESTAMP(3),
    "requester_last_read_at" TIMESTAMP(3),
    "recipient_last_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_messages" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_request_reports" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" VARCHAR(1000),
    "status" TEXT NOT NULL DEFAULT 'open',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_request_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_events" (
    "id" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "company_id" TEXT,
    "request_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "post_id" TEXT,
    "session_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "properties" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "marketplace_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_deliveries" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_requests_requester_id_created_at_idx" ON "marketplace_requests"("requester_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_requests_recipient_id_created_at_idx" ON "marketplace_requests"("recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_requests_requester_id_recipient_id_idx" ON "marketplace_requests"("requester_id", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_requests_requester_id_idempotency_key_key" ON "marketplace_requests"("requester_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_requests_requester_id_service_listing_id_key" ON "marketplace_requests"("requester_id", "service_listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_requests_requester_id_project_brief_id_key" ON "marketplace_requests"("requester_id", "project_brief_id");

-- CreateIndex
CREATE INDEX "marketplace_messages_request_id_created_at_idx" ON "marketplace_messages"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_messages_sender_id_created_at_idx" ON "marketplace_messages"("sender_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_messages_sender_id_idempotency_key_key" ON "marketplace_messages"("sender_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "marketplace_blocks_blocked_id_idx" ON "marketplace_blocks"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_blocks_blocker_id_blocked_id_key" ON "marketplace_blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "marketplace_request_reports_status_created_at_idx" ON "marketplace_request_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_request_reports_reporter_id_request_id_key" ON "marketplace_request_reports"("reporter_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_events_dedupe_key_key" ON "marketplace_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "marketplace_events_company_id_type_occurred_at_idx" ON "marketplace_events"("company_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "marketplace_events_actor_id_type_occurred_at_idx" ON "marketplace_events"("actor_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "marketplace_events_request_id_idx" ON "marketplace_events"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_deliveries_notification_id_key" ON "marketplace_deliveries"("notification_id");

-- CreateIndex
CREATE INDEX "marketplace_deliveries_status_next_attempt_at_idx" ON "marketplace_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_deliveries_event_id_user_id_key" ON "marketplace_deliveries"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_requester_company_id_fkey" FOREIGN KEY ("requester_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_recipient_company_id_fkey" FOREIGN KEY ("recipient_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_project_brief_id_fkey" FOREIGN KEY ("project_brief_id") REFERENCES "project_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "marketplace_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_blocks" ADD CONSTRAINT "marketplace_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_blocks" ADD CONSTRAINT "marketplace_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_request_reports" ADD CONSTRAINT "marketplace_request_reports_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "marketplace_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_request_reports" ADD CONSTRAINT "marketplace_request_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_events" ADD CONSTRAINT "marketplace_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_events" ADD CONSTRAINT "marketplace_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_deliveries" ADD CONSTRAINT "marketplace_deliveries_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "marketplace_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_deliveries" ADD CONSTRAINT "marketplace_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_deliveries" ADD CONSTRAINT "marketplace_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "marketplace_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Domain checks complement API validation for private participant records.
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_target_check" CHECK (
  (kind = 'service' AND service_listing_id IS NOT NULL AND project_brief_id IS NULL)
  OR (kind = 'project' AND service_listing_id IS NULL AND project_brief_id IS NOT NULL)
);
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_participants_check" CHECK (requester_id <> recipient_id);
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_status_check" CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'blocked'));
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_body_check" CHECK (char_length(btrim(body)) BETWEEN 20 AND 5000);
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_samples_check" CHECK (jsonb_typeof(work_samples) = 'array');
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_body_check" CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000);
ALTER TABLE "marketplace_blocks" ADD CONSTRAINT "marketplace_blocks_participants_check" CHECK (blocker_id <> blocked_id);
ALTER TABLE "marketplace_request_reports" ADD CONSTRAINT "marketplace_request_reports_status_check" CHECK (status IN ('open', 'reviewed'));
ALTER TABLE "marketplace_deliveries" ADD CONSTRAINT "marketplace_deliveries_attempts_check" CHECK (attempts >= 0);
ALTER TABLE "marketplace_deliveries" ADD CONSTRAINT "marketplace_deliveries_status_check" CHECK (status IN ('pending', 'delivered', 'cancelled'));
