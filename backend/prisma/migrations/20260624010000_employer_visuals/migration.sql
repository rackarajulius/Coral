-- Company visuals: photo gallery (uploaded or external URLs) + culture video URL
ALTER TABLE "employer_profiles" ADD COLUMN "gallery_photos" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "employer_profiles" ADD COLUMN "culture_video_url" TEXT;
