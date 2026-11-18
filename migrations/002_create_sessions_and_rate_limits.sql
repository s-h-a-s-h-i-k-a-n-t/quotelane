BEGIN;

CREATE TABLE form_sessions (
    id uuid PRIMARY KEY,
    variant text NOT NULL CHECK (variant IN ('a', 'b')),
    prefill jsonb NOT NULL DEFAULT '{}',
    click_id text,
    aff_id text,
    channel text,
    expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
    submitted boolean NOT NULL DEFAULT false
);

CREATE INDEX form_sessions_expiry_idx ON form_sessions (expires_at);

CREATE TABLE lead_rate_limits (
    ip inet PRIMARY KEY,
    window_start timestamptz NOT NULL,
    attempts integer NOT NULL
);

CREATE INDEX lead_rate_limits_window_idx ON lead_rate_limits (window_start);

COMMIT;
