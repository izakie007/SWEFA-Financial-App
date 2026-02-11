-- =====================================================
-- SWEFA Accounting Triggers
-- Automatic Double-Entry Ledger Entries
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: Get Account ID
-- =====================================================
CREATE OR REPLACE FUNCTION get_account_id(
    p_account_code VARCHAR(20)
)
RETURNS UUID AS $$
DECLARE
    v_account_id UUID;
BEGIN
    SELECT id INTO v_account_id FROM accounts WHERE account_code = p_account_code;
    
    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'Account not found: %', p_account_code;
    END IF;
    
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTION: Create Ledger Entry Pair
-- =====================================================
CREATE OR REPLACE FUNCTION create_ledger_entry_pair(
    p_debit_account_id UUID,
    p_credit_account_id UUID,
    p_amount DECIMAL(15, 2),
    p_reference_type VARCHAR(50),
    p_reference_id UUID,
    p_description TEXT,
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_journal_id UUID;
BEGIN
    -- Generate journal ID for this transaction
    v_journal_id := uuid_generate_v4();
    
    -- Create debit entry
    INSERT INTO ledger_entries (
        account_id, debit_amount, credit_amount, reference_type, reference_id,
        journal_id, description, created_by
    ) VALUES (
        p_debit_account_id, p_amount, 0, p_reference_type, p_reference_id,
        v_journal_id, p_description, p_created_by
    );
    
    -- Create credit entry
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

-- =====================================================
-- 1. TRIGGER: Member Transaction
-- =====================================================
CREATE OR REPLACE FUNCTION handle_member_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_fs_cash_account UUID;
    v_purpose_revenue_account UUID;
    v_chapter_code VARCHAR(10);
    v_purpose_code VARCHAR(10);
    v_description TEXT;
BEGIN
    -- Get chapter code
    SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code 
    FROM chapters WHERE id = NEW.chapter_id;
    
    -- Get FS Cash account
    v_fs_cash_account := get_account_id(v_chapter_code || '-FS-CASH');
    
    -- Determine revenue account based on destination
    IF NEW.destination = 'CHAPTER' THEN
        -- Chapter-level purpose revenue
        SELECT COALESCE(code, LEFT(name, 3)) INTO v_purpose_code 
        FROM purposes WHERE id = NEW.purpose_id;
        
        v_purpose_revenue_account := get_account_id(v_chapter_code || '-' || v_purpose_code || '-REV');
    ELSE
        -- National-level purpose revenue
        SELECT COALESCE(code, LEFT(name, 3)) INTO v_purpose_code 
        FROM purposes WHERE id = NEW.purpose_id;
        
        v_purpose_revenue_account := get_account_id('NAT-' || v_purpose_code || '-REV');
    END IF;
    
    -- Create description
    SELECT 'Member contribution: ' || m.full_name || ' - ' || p.name
    INTO v_description
    FROM members m, purposes p
    WHERE m.id = NEW.member_id AND p.id = NEW.purpose_id;
    
    -- Create ledger entries (DEBIT: FS Cash, CREDIT: Purpose Revenue)
    PERFORM create_ledger_entry_pair(
        v_fs_cash_account,
        v_purpose_revenue_account,
        NEW.amount,
        'MEMBER_TRANSACTION',
        NEW.id,
        v_description,
        NEW.recorded_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_member_transaction_ledger
AFTER INSERT ON member_transactions
FOR EACH ROW
EXECUTE FUNCTION handle_member_transaction();

-- =====================================================
-- 2. TRIGGER: FS to Chapter Treasurer Handover
-- =====================================================
CREATE OR REPLACE FUNCTION handle_fs_handover()
RETURNS TRIGGER AS $$
DECLARE
    v_fs_cash_account UUID;
    v_treasurer_cash_account UUID;
    v_chapter_code VARCHAR(10);
    v_description TEXT;
    v_has_funds BOOLEAN;
BEGIN
    -- Get chapter code
    SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code 
    FROM chapters WHERE id = NEW.chapter_id;
    
    -- Get accounts
    v_fs_cash_account := get_account_id(v_chapter_code || '-FS-CASH');
    v_treasurer_cash_account := get_account_id(v_chapter_code || '-TR-CASH');
    
    -- Validate sufficient funds
    v_has_funds := check_sufficient_funds(v_fs_cash_account, NEW.amount);
    
    IF NOT v_has_funds THEN
        RAISE EXCEPTION 'Insufficient funds in FS Cash Account. Available: %, Required: %',
            (SELECT current_balance FROM account_balances WHERE account_id = v_fs_cash_account),
            NEW.amount;
    END IF;
    
    -- Create description
    SELECT 'Handover to Treasurer - ' || p.name
    INTO v_description
    FROM purposes p
    WHERE p.id = NEW.purpose_id;
    
    -- Create ledger entries (DEBIT: Treasurer Cash, CREDIT: FS Cash)
    PERFORM create_ledger_entry_pair(
        v_treasurer_cash_account,
        v_fs_cash_account,
        NEW.amount,
        'FS_HANDOVER',
        NEW.id,
        v_description,
        NEW.handed_over_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fs_handover_ledger
AFTER INSERT ON fs_to_chapter_treasurer
FOR EACH ROW
EXECUTE FUNCTION handle_fs_handover();

-- =====================================================
-- 3. TRIGGER: Chapter Bank Transactions
-- =====================================================
CREATE OR REPLACE FUNCTION handle_chapter_bank_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_treasurer_cash_account UUID;
    v_bank_account UUID;
    v_chapter_code VARCHAR(10);
    v_description TEXT;
    v_has_funds BOOLEAN;
BEGIN
    -- Get chapter code
    SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code 
    FROM chapters WHERE id = NEW.chapter_id;
    
    -- Get accounts
    v_treasurer_cash_account := get_account_id(v_chapter_code || '-TR-CASH');
    v_bank_account := get_account_id(v_chapter_code || '-BANK');
    
    -- Create description
    SELECT NEW.transaction_type || ' - ' || p.name || 
           CASE WHEN NEW.reference_number IS NOT NULL 
                THEN ' (Ref: ' || NEW.reference_number || ')' 
                ELSE '' 
           END
    INTO v_description
    FROM purposes p
    WHERE p.id = NEW.purpose_id;
    
    IF NEW.transaction_type = 'DEPOSIT' THEN
        -- Validate sufficient cash
        v_has_funds := check_sufficient_funds(v_treasurer_cash_account, NEW.amount);
        
        IF NOT v_has_funds THEN
            RAISE EXCEPTION 'Insufficient cash for deposit. Available: %, Required: %',
                (SELECT current_balance FROM account_balances WHERE account_id = v_treasurer_cash_account),
                NEW.amount;
        END IF;
        
        -- DEBIT: Bank, CREDIT: Treasurer Cash
        PERFORM create_ledger_entry_pair(
            v_bank_account,
            v_treasurer_cash_account,
            NEW.amount,
            'BANK_TRANSACTION',
            NEW.id,
            v_description,
            NEW.recorded_by
        );
    ELSE  -- WITHDRAWAL
        -- Validate sufficient bank balance
        v_has_funds := check_sufficient_funds(v_bank_account, NEW.amount);
        
        IF NOT v_has_funds THEN
            RAISE EXCEPTION 'Insufficient bank balance for withdrawal. Available: %, Required: %',
                (SELECT current_balance FROM account_balances WHERE account_id = v_bank_account),
                NEW.amount;
        END IF;
        
        -- DEBIT: Treasurer Cash, CREDIT: Bank
        PERFORM create_ledger_entry_pair(
            v_treasurer_cash_account,
            v_bank_account,
            NEW.amount,
            'BANK_TRANSACTION',
            NEW.id,
            v_description,
            NEW.recorded_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chapter_bank_transaction_ledger
AFTER INSERT ON chapter_bank_transactions
FOR EACH ROW
EXECUTE FUNCTION handle_chapter_bank_transaction();

-- =====================================================
-- 4. TRIGGER: Chapter to National Transfer
-- =====================================================
CREATE OR REPLACE FUNCTION handle_chapter_to_national_transfer()
RETURNS TRIGGER AS $$
DECLARE
    v_chapter_treasurer_account UUID;
    v_national_fs_account UUID;
    v_chapter_code VARCHAR(10);
    v_description TEXT;
    v_has_funds BOOLEAN;
BEGIN
    -- Get chapter code
    SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code 
    FROM chapters WHERE id = NEW.chapter_id;
    
    -- Get accounts
    v_chapter_treasurer_account := get_account_id(v_chapter_code || '-TR-CASH');
    v_national_fs_account := get_account_id('NAT-FS-CASH');
    
    -- Validate sufficient funds
    v_has_funds := check_sufficient_funds(v_chapter_treasurer_account, NEW.amount);
    
    IF NOT v_has_funds THEN
        RAISE EXCEPTION 'Insufficient funds in Treasurer account for transfer. Available: %, Required: %',
            (SELECT current_balance FROM account_balances WHERE account_id = v_chapter_treasurer_account),
            NEW.amount;
    END IF;
    
    -- Create description
    SELECT 'Transfer to National - ' || p.name || ' (Ref: ' || NEW.reference_number || ')'
    INTO v_description
    FROM purposes p
    WHERE p.id = NEW.purpose_id;
    
    -- Create ledger entries (DEBIT: National FS, CREDIT: Chapter Treasurer)
    PERFORM create_ledger_entry_pair(
        v_national_fs_account,
        v_chapter_treasurer_account,
        NEW.amount,
        'CHAPTER_TO_NATIONAL_TRANSFER',
        NEW.id,
        v_description,
        NEW.initiated_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chapter_to_national_transfer_ledger
AFTER INSERT ON chapter_to_national_transfers
FOR EACH ROW
EXECUTE FUNCTION handle_chapter_to_national_transfer();

-- =====================================================
-- 5. TRIGGER: National FS to National Treasurer Handover
-- =====================================================
CREATE OR REPLACE FUNCTION handle_national_fs_handover()
RETURNS TRIGGER AS $$
DECLARE
    v_national_fs_account UUID;
    v_national_treasurer_account UUID;
    v_description TEXT;
    v_has_funds BOOLEAN;
BEGIN
    -- Get accounts
    v_national_fs_account := get_account_id('NAT-FS-CASH');
    v_national_treasurer_account := get_account_id('NAT-TR-CASH');
    
    -- Validate sufficient funds
    v_has_funds := check_sufficient_funds(v_national_fs_account, NEW.amount);
    
    IF NOT v_has_funds THEN
        RAISE EXCEPTION 'Insufficient funds in National FS account. Available: %, Required: %',
            (SELECT current_balance FROM account_balances WHERE account_id = v_national_fs_account),
            NEW.amount;
    END IF;
    
    -- Create description
    SELECT 'National Handover to Treasurer - ' || p.name
    INTO v_description
    FROM purposes p
    WHERE p.id = NEW.purpose_id;
    
    -- Create ledger entries (DEBIT: National Treasurer, CREDIT: National FS)
    PERFORM create_ledger_entry_pair(
        v_national_treasurer_account,
        v_national_fs_account,
        NEW.amount,
        'NATIONAL_FS_HANDOVER',
        NEW.id,
        v_description,
        NEW.handed_over_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_national_fs_handover_ledger
AFTER INSERT ON fs_to_national_treasurer
FOR EACH ROW
EXECUTE FUNCTION handle_national_fs_handover();

-- =====================================================
-- 6. TRIGGER: National Bank Transactions
-- =====================================================
CREATE OR REPLACE FUNCTION handle_national_bank_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_national_treasurer_account UUID;
    v_national_bank_account UUID;
    v_description TEXT;
    v_has_funds BOOLEAN;
BEGIN
    -- Get accounts
    v_national_treasurer_account := get_account_id('NAT-TR-CASH');
    v_national_bank_account := get_account_id('NAT-BANK');
    
    -- Create description
    SELECT NEW.transaction_type || ' - ' || p.name || 
           CASE WHEN NEW.reference_number IS NOT NULL 
                THEN ' (Ref: ' || NEW.reference_number || ')' 
                ELSE '' 
           END
    INTO v_description
    FROM purposes p
    WHERE p.id = NEW.purpose_id;
    
    IF NEW.transaction_type = 'DEPOSIT' THEN
        -- Validate sufficient cash
        v_has_funds := check_sufficient_funds(v_national_treasurer_account, NEW.amount);
        
        IF NOT v_has_funds THEN
            RAISE EXCEPTION 'Insufficient cash for deposit. Available: %, Required: %',
                (SELECT current_balance FROM account_balances WHERE account_id = v_national_treasurer_account),
                NEW.amount;
        END IF;
        
        -- DEBIT: Bank, CREDIT: Treasurer Cash
        PERFORM create_ledger_entry_pair(
            v_national_bank_account,
            v_national_treasurer_account,
            NEW.amount,
            'NATIONAL_BANK_TRANSACTION',
            NEW.id,
            v_description,
            NEW.recorded_by
        );
    ELSE  -- WITHDRAWAL
        -- Validate sufficient bank balance
        v_has_funds := check_sufficient_funds(v_national_bank_account, NEW.amount);
        
        IF NOT v_has_funds THEN
            RAISE EXCEPTION 'Insufficient bank balance for withdrawal. Available: %, Required: %',
                (SELECT current_balance FROM account_balances WHERE account_id = v_national_bank_account),
                NEW.amount;
        END IF;
        
        -- DEBIT: Treasurer Cash, CREDIT: Bank
        PERFORM create_ledger_entry_pair(
            v_national_treasurer_account,
            v_national_bank_account,
            NEW.amount,
            'NATIONAL_BANK_TRANSACTION',
            NEW.id,
            v_description,
            NEW.recorded_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_national_bank_transaction_ledger
AFTER INSERT ON national_bank_transactions
FOR EACH ROW
EXECUTE FUNCTION handle_national_bank_transaction();

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON FUNCTION handle_member_transaction IS 'Creates ledger entries when member makes a contribution (DEBIT: FS Cash, CREDIT: Purpose Revenue)';
COMMENT ON FUNCTION handle_fs_handover IS 'Creates ledger entries for FS to Treasurer handover (DEBIT: Treasurer Cash, CREDIT: FS Cash)';
COMMENT ON FUNCTION handle_chapter_bank_transaction IS 'Creates ledger entries for bank deposits/withdrawals';
COMMENT ON FUNCTION handle_chapter_to_national_transfer IS 'Creates ledger entries for chapter to national transfers';
COMMENT ON FUNCTION handle_national_fs_handover IS 'Creates ledger entries for national FS to Treasurer handover';
COMMENT ON FUNCTION handle_national_bank_transaction IS 'Creates ledger entries for national bank transactions';
