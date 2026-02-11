-- =====================================================
-- SWEFA Seed Accounts
-- Initialize System Accounts for Chapters and National
-- =====================================================

-- =====================================================
-- 1. CREATE SYSTEM ACCOUNT CODES
-- =====================================================

-- Function to create standard accounts for a chapter
CREATE OR REPLACE FUNCTION create_chapter_accounts(p_chapter_id UUID)
RETURNS VOID AS $$
DECLARE
    v_asset_type_id UUID;
    v_revenue_type_id UUID;
    v_chapter_code VARCHAR(10);
BEGIN
    -- Get account type IDs
    SELECT id INTO v_asset_type_id FROM account_types WHERE name = 'ASSET';
    SELECT id INTO v_revenue_type_id FROM account_types WHERE name = 'REVENUE';
    
    -- Get chapter code (assuming chapters table has a code column, otherwise use first 3 chars of name)
    SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code FROM chapters WHERE id = p_chapter_id;
    
    -- Create FS Cash Account
    INSERT INTO accounts (account_code, name, account_type_id, chapter_id, is_system_account, description)
    VALUES (
        v_chapter_code || '-FS-CASH',
        'Financial Secretary Cash Account',
        v_asset_type_id,
        p_chapter_id,
        TRUE,
        'Cash held by Chapter Financial Secretary'
    )
    ON CONFLICT (account_code) DO NOTHING;
    
    -- Create Treasurer Cash Account
    INSERT INTO accounts (account_code, name, account_type_id, chapter_id, is_system_account, description)
    VALUES (
        v_chapter_code || '-TR-CASH',
        'Treasurer Cash Account',
        v_asset_type_id,
        p_chapter_id,
        TRUE,
        'Cash held by Chapter Treasurer'
    )
    ON CONFLICT (account_code) DO NOTHING;
    
    -- Create Bank Account
    INSERT INTO accounts (account_code, name, account_type_id, chapter_id, is_system_account, description)
    VALUES (
        v_chapter_code || '-BANK',
        'Chapter Bank Account',
        v_asset_type_id,
        p_chapter_id,
        TRUE,
        'Chapter bank account balance'
    )
    ON CONFLICT (account_code) DO NOTHING;
    
    -- Initialize balances for these accounts
    INSERT INTO account_balances (account_id, current_balance, total_debits, total_credits)
    SELECT id, 0, 0, 0 FROM accounts 
    WHERE chapter_id = p_chapter_id AND is_system_account = TRUE
    ON CONFLICT (account_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. CREATE PURPOSE ACCOUNTS FOR CHAPTER
-- =====================================================

CREATE OR REPLACE FUNCTION create_chapter_purpose_account(
    p_chapter_id UUID,
    p_purpose_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_revenue_type_id UUID;
    v_chapter_code VARCHAR(10);
    v_purpose_code VARCHAR(10);
    v_purpose_name VARCHAR(100);
BEGIN
    -- Get revenue account type
    SELECT id INTO v_revenue_type_id FROM account_types WHERE name = 'REVENUE';
    
    -- Get chapter and purpose codes
    SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code FROM chapters WHERE id = p_chapter_id;
    SELECT COALESCE(code, LEFT(name, 3)), name INTO v_purpose_code, v_purpose_name FROM purposes WHERE id = p_purpose_id;
    
    -- Create purpose revenue account
    INSERT INTO accounts (account_code, name, account_type_id, chapter_id, purpose_id, is_system_account, description)
    VALUES (
        v_chapter_code || '-' || v_purpose_code || '-REV',
        v_purpose_name || ' Revenue',
        v_revenue_type_id,
        p_chapter_id,
        p_purpose_id,
        FALSE,
        'Revenue from ' || v_purpose_name || ' contributions'
    )
    ON CONFLICT (account_code) DO NOTHING;
    
    -- Initialize balance
    INSERT INTO account_balances (account_id, current_balance, total_debits, total_credits)
    SELECT id, 0, 0, 0 FROM accounts 
    WHERE chapter_id = p_chapter_id AND purpose_id = p_purpose_id
    ON CONFLICT (account_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. CREATE NATIONAL ACCOUNTS
-- =====================================================

CREATE OR REPLACE FUNCTION create_national_accounts()
RETURNS VOID AS $$
DECLARE
    v_asset_type_id UUID;
BEGIN
    -- Get asset account type
    SELECT id INTO v_asset_type_id FROM account_types WHERE name = 'ASSET';
    
    -- Create National FS Cash Account
    INSERT INTO accounts (account_code, name, account_type_id, chapter_id, is_system_account, description)
    VALUES (
        'NAT-FS-CASH',
        'National Financial Secretary Cash Account',
        v_asset_type_id,
        NULL,
        TRUE,
        'Cash held by National Financial Secretary'
    )
    ON CONFLICT (account_code) DO NOTHING;
    
    -- Create National Treasurer Cash Account
    INSERT INTO accounts (account_code, name, account_type_id, chapter_id, is_system_account, description)
    VALUES (
        'NAT-TR-CASH',
        'National Treasurer Cash Account',
        v_asset_type_id,
        NULL,
        TRUE,
        'Cash held by National Treasurer'
    )
    ON CONFLICT (account_code) DO NOTHING;
    
    -- Create National Bank Account
    INSERT INTO accounts (account_code, name, account_type_id, chapter_id, is_system_account, description)
    VALUES (
        'NAT-BANK',
        'National Bank Account',
        v_asset_type_id,
        NULL,
        TRUE,
        'National bank account balance'
    )
    ON CONFLICT (account_code) DO NOTHING;
    
    -- Initialize balances
    INSERT INTO account_balances (account_id, current_balance, total_debits, total_credits)
    SELECT id, 0, 0, 0 FROM accounts 
    WHERE chapter_id IS NULL AND is_system_account = TRUE
    ON CONFLICT (account_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREATE NATIONAL PURPOSE ACCOUNTS
-- =====================================================

CREATE OR REPLACE FUNCTION create_national_purpose_account(p_purpose_id UUID)
RETURNS VOID AS $$
DECLARE
    v_revenue_type_id UUID;
    v_purpose_code VARCHAR(10);
    v_purpose_name VARCHAR(100);
BEGIN
    -- Get revenue account type
    SELECT id INTO v_revenue_type_id FROM account_types WHERE name = 'REVENUE';
    
    -- Get purpose details
    SELECT COALESCE(code, LEFT(name, 3)), name INTO v_purpose_code, v_purpose_name FROM purposes WHERE id = p_purpose_id;
    
    -- Create national purpose revenue account
    INSERT INTO accounts (account_code, name, account_type_id, chapter_id, purpose_id, is_system_account, description)
    VALUES (
        'NAT-' || v_purpose_code || '-REV',
        'National ' || v_purpose_name || ' Revenue',
        v_revenue_type_id,
        NULL,
        p_purpose_id,
        FALSE,
        'National revenue from ' || v_purpose_name || ' contributions'
    )
    ON CONFLICT (account_code) DO NOTHING;
    
    -- Initialize balance
    INSERT INTO account_balances (account_id, current_balance, total_debits, total_credits)
    SELECT id, 0, 0, 0 FROM accounts 
    WHERE chapter_id IS NULL AND purpose_id = p_purpose_id
    ON CONFLICT (account_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. SEED ALL EXISTING CHAPTERS
-- =====================================================

-- Create accounts for all existing chapters
DO $$
DECLARE
    chapter_record RECORD;
BEGIN
    FOR chapter_record IN SELECT id FROM chapters WHERE is_active = TRUE
    LOOP
        PERFORM create_chapter_accounts(chapter_record.id);
    END LOOP;
END $$;

-- =====================================================
-- 6. SEED ALL CHAPTER-PURPOSE COMBINATIONS
-- =====================================================

-- Create purpose accounts for all chapter-purpose combinations
DO $$
DECLARE
    chapter_record RECORD;
    purpose_record RECORD;
BEGIN
    FOR chapter_record IN SELECT id FROM chapters WHERE is_active = TRUE
    LOOP
        FOR purpose_record IN SELECT id FROM purposes WHERE is_active = TRUE AND level = 'CHAPTER'
        LOOP
            PERFORM create_chapter_purpose_account(chapter_record.id, purpose_record.id);
        END LOOP;
    END LOOP;
END $$;

-- =====================================================
-- 7. SEED NATIONAL ACCOUNTS
-- =====================================================

-- Create national system accounts
SELECT create_national_accounts();

-- Create national purpose accounts
DO $$
DECLARE
    purpose_record RECORD;
BEGIN
    FOR purpose_record IN SELECT id FROM purposes WHERE is_active = TRUE AND level = 'NATIONAL'
    LOOP
        PERFORM create_national_purpose_account(purpose_record.id);
    END LOOP;
END $$;

-- =====================================================
-- 8. TRIGGERS: Auto-create accounts for new chapters/purposes
-- =====================================================

-- Trigger to create accounts when new chapter is created
CREATE OR REPLACE FUNCTION trigger_create_chapter_accounts()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_chapter_accounts(NEW.id);
    
    -- Also create purpose accounts for all active chapter purposes
    PERFORM create_chapter_purpose_account(NEW.id, p.id)
    FROM purposes p
    WHERE p.is_active = TRUE AND p.level = 'CHAPTER';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_new_chapter_accounts
AFTER INSERT ON chapters
FOR EACH ROW
EXECUTE FUNCTION trigger_create_chapter_accounts();

-- Trigger to create accounts when new purpose is created
CREATE OR REPLACE FUNCTION trigger_create_purpose_accounts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.level = 'CHAPTER' THEN
        -- Create purpose account for all active chapters
        PERFORM create_chapter_purpose_account(c.id, NEW.id)
        FROM chapters c
        WHERE c.is_active = TRUE;
    ELSIF NEW.level = 'NATIONAL' THEN
        -- Create national purpose account
        PERFORM create_national_purpose_account(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_new_purpose_accounts
AFTER INSERT ON purposes
FOR EACH ROW
EXECUTE FUNCTION trigger_create_purpose_accounts();

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON FUNCTION create_chapter_accounts IS 'Creates standard system accounts (FS Cash, Treasurer Cash, Bank) for a chapter';
COMMENT ON FUNCTION create_chapter_purpose_account IS 'Creates a revenue account for a specific purpose within a chapter';
COMMENT ON FUNCTION create_national_accounts IS 'Creates national-level system accounts';
COMMENT ON FUNCTION create_national_purpose_account IS 'Creates a revenue account for a national-level purpose';
