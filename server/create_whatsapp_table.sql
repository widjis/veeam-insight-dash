-- Create whatsapp_configs table
CREATE TABLE IF NOT EXISTS whatsapp_configs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    api_url TEXT,
    access_token TEXT,
    phone_number_id TEXT,
    enable_image_reports BOOLEAN DEFAULT false,
    comprehensive_image_report BOOLEAN DEFAULT false,
    image_quality TEXT DEFAULT 'high',
    max_image_width INTEGER DEFAULT 1200,
    max_image_height INTEGER DEFAULT 800,
    default_recipients TEXT[] DEFAULT '{}',
    report_message_template TEXT,
    alert_message_template TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT
);