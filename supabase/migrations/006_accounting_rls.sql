-- =====================================================
-- SWEFA Accounting Security
-- Row Level Security (RLS) Policies & Function Hardening
-- =====================================================

-- 1. HARDEN ACCOUNTING FUNCTIONS
-- Make critical functions SECURITY DEFINER so they operate with elevated
-- privileges (bypassing RLS), but restrict their usage to triggers only.

-- Redefine create_ledger_entry_pair with SECURITY DEFINER and Trigger Check
CREATE OR REPLACE FUNCTION create_ledger_entry_pair(
    p_debit_account_id UUID,
    p_credit_account_id UUID,
    p_amount DECIMAL(15, 2),
    p_reference_type VARCHAR(50),
    p_reference_id UUID,
    p_description TEXT,
    p_created_by UUID
)
RETURNS UUID 
SECURITY DEFINER  -- Run as owner (elevated privileges)
SET search_path = public
AS $$
DECLARE
    v_journal_id UUID;
BEGIN
    -- Security Measure: Ensure this is only called from a trigger context
    -- or by a superuser/admin context, preventing direct API calls
    IF pg_trigger_depth() = 0 AND session_user != 'postgres' THEN
        RAISE EXCEPTION 'This function can only be called via system triggers.';
    END IF;

    v_journal_id := uuid_generate_v4();
    
    INSERT INTO ledger_entries (
        account_id, debit_amount, credit_amount, reference_type, reference_id,
        journal_id, description, created_by
    ) VALUES (
        p_debit_account_id, p_amount, 0, p_reference_type, p_reference_id,
        v_journal_id, p_description, p_created_by
    );
    
    INSERT INTO ledger_entries (
        account_id, debit_amount, credit_amount, reference_type, reference_id,
        journal_id, description, created_by
    ) VALUES (
        p_credit_account_id, 0, p_amount, p_reference_type, p_reference_id,
        v_journal_id, p_description, p_created_by
    );
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;

-- Make helper functions SECURITY DEFINER
ALTER FUNCTION update_account_balance(UUID) SECURITY DEFINER;
ALTER FUNCTION check_sufficient_funds(UUID, DECIMAL) SECURITY DEFINER;

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE account_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

-- 3. REVOKE DIRECT WRITE ACCESS
-- Prevent users from getting clever and finding a way to insert directly
REVOKE INSERT, UPDATE, DELETE ON ledger_entries FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON account_balances FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON accounts FROM authenticated;

-- Grant SELECT only
GRANT SELECT ON account_types TO authenticated;
GRANT SELECT ON accounts TO authenticated;
GRANT SELECT ON ledger_entries TO authenticated;
GRANT SELECT ON account_balances TO authenticated;

-- 4. DEFINE RLS POLICIES

-- >>> Account Types <<<
-- Everyone can read account types
CREATE POLICY "account_types_read_policy" ON account_types
    FOR SELECT TO authenticated
    USING (true);

-- >>> Accounts <<<
-- Logic:
-- 1. National/Admins see ALL accounts
-- 2. Chapter users see:
--    a) Their chapter's accounts
--    b) National system accounts (needed for transfers)
CREATE POLICY "accounts_read_policy" ON accounts
    FOR SELECT TO authenticated
    USING (
        -- Admin Access
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'NATIONAL_TREASURER', 'NATIONAL_FS')
        OR
        -- Chapter Access
        (
            -- Own Chapter
            chapter_id = (SELECT chapter_id FROM public.profiles WHERE id = auth.uid())
            OR
            -- National System Accounts (visible to all for reference)
            (chapter_id IS NULL AND is_system_account = TRUE)
        )
    );

-- >>> Account Balances <<<
-- Logic: Can see balances for any account you can see
-- This implementation relies on the 'accounts_read_policy' implicitly
-- by querying the restricted 'accounts' table in the subquery.
CREATE POLICY "balances_read_policy" ON account_balances
    FOR SELECT TO authenticated
    USING (
        account_id IN (SELECT id FROM accounts)
    );

-- >>> Ledger Entries <<<
-- Logic: Can see entries for any account you can see
CREATE POLICY "ledger_read_policy" ON ledger_entries
    FOR SELECT TO authenticated
    USING (
        account_id IN (SELECT id FROM accounts)
    );

-- Comments
COMMENT ON POLICY "accounts_read_policy" ON accounts IS 'Controls visibility of the Chart of Accounts based on user role and chapter';
COMMENT ON FUNCTION create_ledger_entry_pair IS 'Creates double-entry records. SECURITY DEFINER; restricted to trigger execution.';
