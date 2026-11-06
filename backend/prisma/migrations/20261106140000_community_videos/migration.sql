-- Community post videos streamed by Mux.
CREATE TYPE "CommunityVideoStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE "community_videos" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT,
    "mux_upload_id" TEXT NOT NULL,
    "mux_asset_id" TEXT,
    "playback_id" TEXT,
    "status" "CommunityVideoStatus" NOT NULL DEFAULT 'UPLOADING',
    "duration_seconds" DOUBLE PRECISION,
    "aspect_ratio" VARCHAR(20),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_videos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_videos_mux_upload_id_key" ON "community_videos"("mux_upload_id");
CREATE UNIQUE INDEX "community_videos_mux_asset_id_key" ON "community_videos"("mux_asset_id");
CREATE UNIQUE INDEX "community_videos_playback_id_key" ON "community_videos"("playback_id");
CREATE INDEX "community_videos_owner_id_created_at_idx" ON "community_videos"("owner_id", "created_at");
CREATE INDEX "community_videos_status_created_at_idx" ON "community_videos"("status", "created_at");

ALTER TABLE "community_videos" ADD CONSTRAINT "community_videos_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
