-- A PDF shared as a community post: the file, its title, and the page count read on upload.
ALTER TABLE "posts" ADD COLUMN "document_url" TEXT,
ADD COLUMN "document_title" VARCHAR(150),
ADD COLUMN "document_pages" INTEGER;
