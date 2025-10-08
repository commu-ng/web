-- Add full-text search index on post.content for efficient search queries
-- Using 'simple' configuration for better multilingual support (Korean, English, etc.)
CREATE INDEX IF NOT EXISTS "idx_post_content_search" ON "post" USING GIN (to_tsvector('simple', "content"));
