BEGIN;

CREATE TABLE leads (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    variant text NOT NULL CHECK (variant IN ('a', 'b')),
    zip text NOT NULL CHECK (zip ~ '^[0-9]{5}$' AND zip <> '00000'),
    insured boolean NOT NULL,
    vehicle_year smallint,
    vehicle_make text,
    age_range text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    click_id text,
    aff_id text,
    channel text,
    prefilled_fields text[] NOT NULL DEFAULT '{}',
    CHECK (
        variant = 'b'
        OR (vehicle_year IS NOT NULL AND vehicle_make IS NOT NULL AND age_range IS NOT NULL)
    )
);

-- Support a rolling 24-hour search without permanently banning reused contact details.
CREATE INDEX leads_email_created_at_idx ON leads (email, created_at);
CREATE INDEX leads_phone_created_at_idx ON leads (phone, created_at);

CREATE TABLE lead_consents (
    lead_id bigint PRIMARY KEY REFERENCES leads (id) ON DELETE CASCADE,
    consent_text text NOT NULL,
    submitted_at timestamptz NOT NULL,
    request_ip inet NOT NULL,
    user_agent text NOT NULL,
    page_url text NOT NULL
);

COMMIT;
