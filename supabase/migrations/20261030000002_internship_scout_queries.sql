-- Extend existing Job Scout's board-search queue rather than creating another crawler.
-- Never turn on external boards without operator credentials/configuration.
UPDATE public.scout_settings
SET board_queries = CASE WHEN board_queries @> '[{"search_term":"internship"}]'::jsonb
  THEN board_queries ELSE board_queries || '[{"search_term":"internship"},{"search_term":"co-op internship"}]'::jsonb END
WHERE id = 1 AND jsonb_typeof(board_queries) = 'array';
