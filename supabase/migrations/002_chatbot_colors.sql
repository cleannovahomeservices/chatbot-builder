ALTER TABLE public.chatbots
  ADD COLUMN IF NOT EXISTS primary_color   TEXT DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#4338ca',
  ADD COLUMN IF NOT EXISTS source_url      TEXT;
