-- Expression GIN index backing full-text search over issue title + description.
-- The /api/search query uses the identical expression so the planner can use it.
CREATE INDEX "issues_search_idx" ON "issues"
USING gin (to_tsvector('english', "title" || ' ' || coalesce("description", '')));
