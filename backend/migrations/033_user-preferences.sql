-- User preferences (theme, font size, a11y)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id       UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  theme         TEXT NOT NULL DEFAULT 'light',
  font_size     TEXT NOT NULL DEFAULT 'medium',
  high_contrast BOOLEAN NOT NULL DEFAULT false,
  preferences   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
