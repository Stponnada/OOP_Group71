-- =====================================================================================
-- Reference data. Idempotent: safe to re-run, and safe to ship to an environment where an
-- administrator has already edited a row.
-- =====================================================================================

INSERT INTO itsm.skills (code, name) VALUES
    ('NETWORK',      'Network engineering'),
    ('DATABASE',     'Database administration'),
    ('CLOUD',        'Cloud platforms'),
    ('SECURITY',     'Security operations'),
    ('IDENTITY',     'Identity and access'),
    ('APPLICATION',  'Application support'),
    ('HARDWARE',     'Hardware repair'),
    ('STORAGE',      'Storage and backup'),
    ('PAYMENTS',     'Payment systems')
ON CONFLICT (code) DO NOTHING;

INSERT INTO itsm.sla_profiles (code, name, description) VALUES
    ('STANDARD', 'Standard', 'The house default for every service without an override.'),
    ('CRITICAL-SERVICE', 'Critical service', 'Tighter targets for revenue-bearing or regulated services.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO itsm.sla_targets (sla_profile_id, priority, response_minutes, resolution_minutes, warning_percent)
SELECT p.id, t.priority, t.response_minutes, t.resolution_minutes, 75
FROM itsm.sla_profiles p
JOIN (VALUES
    ('STANDARD',         'P1',   5,   30),
    ('STANDARD',         'P2',  15,  120),
    ('STANDARD',         'P3',  60,  480),
    ('STANDARD',         'P4', 240, 1440),
    ('CRITICAL-SERVICE', 'P1',   5,   20),
    ('CRITICAL-SERVICE', 'P2',  10,   90),
    ('CRITICAL-SERVICE', 'P3',  45,  360),
    ('CRITICAL-SERVICE', 'P4', 180, 1440)
) AS t(profile_code, priority, response_minutes, resolution_minutes)
  ON t.profile_code = p.code
ON CONFLICT (sla_profile_id, priority) DO NOTHING;

INSERT INTO itsm.service_categories (code, name, sort_order) VALUES
    ('HARDWARE',       'Hardware',       10),
    ('SOFTWARE',       'Software',       20),
    ('NETWORK',        'Network',        30),
    ('DATABASE',       'Database',       40),
    ('CLOUD',          'Cloud',          50),
    ('SECURITY',       'Security',       60),
    ('AUTHENTICATION', 'Authentication', 70),
    ('APPLICATION',    'Application',    80),
    ('STORAGE',        'Storage',        90)
ON CONFLICT (code) DO NOTHING;

INSERT INTO itsm.service_catalog
    (code, name, category_id, business_criticality, sla_profile_id)
SELECT v.code, v.name, c.id, v.criticality, p.id
FROM (VALUES
    ('PAYMENTS',       'Payment application',      'APPLICATION',    'REVENUE_OR_REGULATED', 'CRITICAL-SERVICE'),
    ('AUTH',           'Authentication service',   'AUTHENTICATION', 'REVENUE_OR_REGULATED', 'CRITICAL-SERVICE'),
    ('ERP-DB',         'ERP database',             'DATABASE',       'CRITICAL',             'CRITICAL-SERVICE'),
    ('EMAIL',          'Email and collaboration',  'SOFTWARE',       'HIGH',                 'STANDARD'),
    ('VPN',            'Remote access VPN',        'NETWORK',        'HIGH',                 'STANDARD'),
    ('CLOUD-STORAGE',  'Cloud storage',            'STORAGE',        'MEDIUM',               'STANDARD'),
    ('PRINT',          'Printing',                 'HARDWARE',       'LOW',                  'STANDARD'),
    ('LAPTOP',         'Laptop and desktop',       'HARDWARE',       'MEDIUM',               'STANDARD'),
    ('INTRANET',       'Intranet',                 'APPLICATION',    'MEDIUM',               'STANDARD')
) AS v(code, name, category_code, criticality, profile_code)
JOIN itsm.service_categories c ON c.code = v.category_code
JOIN itsm.sla_profiles p ON p.code = v.profile_code
ON CONFLICT (code) DO NOTHING;

INSERT INTO itsm.service_required_skills (service_id, skill_id, weight)
SELECT s.id, k.id, 1.0
FROM (VALUES
    ('PAYMENTS', 'PAYMENTS'),
    ('PAYMENTS', 'APPLICATION'),
    ('AUTH',     'IDENTITY'),
    ('AUTH',     'SECURITY'),
    ('ERP-DB',   'DATABASE'),
    ('EMAIL',    'APPLICATION'),
    ('VPN',      'NETWORK'),
    ('VPN',      'SECURITY'),
    ('CLOUD-STORAGE', 'STORAGE'),
    ('CLOUD-STORAGE', 'CLOUD'),
    ('PRINT',    'HARDWARE'),
    ('LAPTOP',   'HARDWARE'),
    ('INTRANET', 'APPLICATION')
) AS v(service_code, skill_code)
JOIN itsm.service_catalog s ON s.code = v.service_code
JOIN itsm.skills k ON k.code = v.skill_code
ON CONFLICT (service_id, skill_id) DO NOTHING;
