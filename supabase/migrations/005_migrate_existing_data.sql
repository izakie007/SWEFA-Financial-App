-- =====================================================
-- SWEFA Data Migration
-- Backfill Historical Ledger Entries
-- =====================================================

-- =====================================================
-- IMPORTANT: Run this AFTER all other migrations
-- This script processes existing transaction data
-- =====================================================

-- Temporarily disable triggers to avoid duplicate entries
ALTER TABLE member_transactions DISABLE TRIGGER trg_member_transaction_ledger;
ALTER TABLE fs_to_chapter_treasurer DISABLE TRIGGER trg_fs_handover_ledger;
ALTER TABLE chapter_bank_transactions DISABLE TRIGGER trg_chapter_bank_transaction_ledger;
ALTER TABLE chapter_to_national_transfers DISABLE TRIGGER trg_chapter_to_national_transfer_ledger;
ALTER TABLE fs_to_national_treasurer DISABLE TRIGGER trg_national_fs_handover_ledger;
ALTER TABLE national_bank_transactions DISABLE TRIGGER trg_national_bank_transaction_ledger;

-- =====================================================
-- 1. Migrate Member Transactions
-- =====================================================
DO $$
DECLARE
    trans_record RECORD;
    v_fs_cash_account UUID;
    v_purpose_revenue_account UUID;
    v_chapter_code VARCHAR(10);
    v_purpose_code VARCHAR(10);
    v_description TEXT;
BEGIN
    RAISE NOTICE 'Migrating member transactions...';
    
    FOR trans_record IN 
        SELECT * FROM member_transactions ORDER BY created_at
    LOOP
        -- Get chapter code
        SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code 
        FROM chapters WHERE id = trans_record.chapter_id;
        
        -- Get FS Cash account
        SELECT id INTO v_fs_cash_account 
        FROM accounts WHERE account_code = v_chapter_code || '-FS-CASH';
        
        -- Determine revenue account
        IF trans_record.destination = 'CHAPTER' THEN
            SELECT COALESCE(code, LEFT(name, 3)) INTO v_purpose_code 
            FROM purposes WHERE id = trans_record.purpose_id;
            
            SELECT id INTO v_purpose_revenue_account 
            FROM accounts WHERE account_code = v_chapter_code || '-' || v_purpose_code || '-REV';
        ELSE
            SELECT COALESCE(code, LEFT(name, 3)) INTO v_purpose_code 
            FROM purposes WHERE id = trans_record.purpose_id;
            
            SELECT id INTO v_purpose_revenue_account 
            FROM accounts WHERE account_code = 'NAT-' || v_purpose_code || '-REV';
        END IF;
        
        -- Create description
        SELECT 'Member contribution: ' || m.full_name || ' - ' || p.name
        INTO v_description
        FROM members m, purposes p
        WHERE m.id = trans_record.member_id AND p.id = trans_record.purpose_id;
        
        -- Create ledger entries
        PERFORM create_ledger_entry_pair(
            v_fs_cash_account,
            v_purpose_revenue_account,
            trans_record.amount,
            'MEMBER_TRANSACTION',
            trans_record.id,
            v_description,
            trans_record.recorded_by
        );
    END LOOP;
    
    RAISE NOTICE 'Member transactions migrated successfully';
END $$;

-- =====================================================
-- 2. Migrate FS Handovers
-- =====================================================
DO $$
DECLARE
    handover_record RECORD;
    v_fs_cash_account UUID;
    v_treasurer_cash_account UUID;
    v_chapter_code VARCHAR(10);
    v_description TEXT;
BEGIN
    RAISE NOTICE 'Migrating FS handovers...';
    
    FOR handover_record IN 
        SELECT * FROM fs_to_chapter_treasurer ORDER BY handed_over_at
    LOOP
        -- Get chapter code
        SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code 
        FROM chapters WHERE id = handover_record.chapter_id;
        
        -- Get accounts
        SELECT id INTO v_fs_cash_account 
        FROM accounts WHERE account_code = v_chapter_code || '-FS-CASH';
        
        SELECT id INTO v_treasurer_cash_account 
        FROM accounts WHERE account_code = v_chapter_code || '-TR-CASH';
        
        -- Create description
        SELECT 'Handover to Treasurer - ' || p.name
        INTO v_description
        FROM purposes p WHERE p.id = handover_record.purpose_id;
        
        -- Create ledger entries
        PERFORM create_ledger_entry_pair(
            v_treasurer_cash_account,
            v_fs_cash_account,
            handover_record.amount,
            'FS_HANDOVER',
            handover_record.id,
            v_description,
            handover_record.handed_over_by
        );
    END LOOP;
    
    RAISE NOTICE 'FS handovers migrated successfully';
END $$;

-- =====================================================
-- 3. Migrate Chapter Bank Transactions
-- =====================================================
DO $$
DECLARE
    bank_record RECORD;
    v_treasurer_cash_account UUID;
    v_bank_account UUID;
    v_chapter_code VARCHAR(10);
    v_description TEXT;
BEGIN
    RAISE NOTICE 'Migrating chapter bank transactions...';
    
    FOR bank_record IN 
        SELECT * FROM chapter_bank_transactions ORDER BY transaction_date
    LOOP
        -- Get chapter code
        SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code 
        FROM chapters WHERE id = bank_record.chapter_id;
        
        -- Get accounts
        SELECT id INTO v_treasurer_cash_account 
        FROM accounts WHERE account_code = v_chapter_code || '-TR-CASH';
        
        SELECT id INTO v_bank_account 
        FROM accounts WHERE account_code = v_chapter_code || '-BANK';
        
        -- Create description
        SELECT bank_record.transaction_type || ' - ' || p.name || 
               CASE WHEN bank_record.reference_number IS NOT NULL 
                    THEN ' (Ref: ' || bank_record.reference_number || ')' 
                    ELSE '' 
               END
        INTO v_description
        FROM purposes p WHERE p.id = bank_record.purpose_id;
        
        -- Create ledger entries based on transaction type
        IF bank_record.transaction_type = 'DEPOSIT' THEN
            PERFORM create_ledger_entry_pair(
                v_bank_account,
                v_treasurer_cash_account,
                bank_record.amount,
                'BANK_TRANSACTION',
                bank_record.id,
                v_description,
                bank_record.recorded_by
            );
        ELSE  -- WITHDRAWAL
            PERFORM create_ledger_entry_pair(
                v_treasurer_cash_account,
                v_bank_account,
                bank_record.amount,
                'BANK_TRANSACTION',
                bank_record.id,
                v_description,
                bank_record.recorded_by
            );
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Chapter bank transactions migrated successfully';
END $$;

-- =====================================================
-- 4. Migrate Chapter to National Transfers
-- =====================================================
DO $$
DECLARE
    transfer_record RECORD;
    v_chapter_treasurer_account UUID;
    v_national_fs_account UUID;
    v_chapter_code VARCHAR(10);
    v_description TEXT;
BEGIN
    RAISE NOTICE 'Migrating chapter to national transfers...';
    
    FOR transfer_record IN 
        SELECT * FROM chapter_to_national_transfers ORDER BY transfer_date
    LOOP
        -- Get chapter code
        SELECT COALESCE(code, LEFT(name, 3)) INTO v_chapter_code 
        FROM chapters WHERE id = transfer_record.chapter_id;
        
        -- Get accounts
        SELECT id INTO v_chapter_treasurer_account 
        FROM accounts WHERE account_code = v_chapter_code || '-TR-CASH';
        
        SELECT id INTO v_national_fs_account 
        FROM accounts WHERE account_code = 'NAT-FS-CASH';
        
        -- Create description
        SELECT 'Transfer to National - ' || p.name || ' (Ref: ' || transfer_record.reference_number || ')'
        INTO v_description
        FROM purposes p WHERE p.id = transfer_record.purpose_id;
        
        -- Create ledger entries
        PERFORM create_ledger_entry_pair(
            v_national_fs_account,
            v_chapter_treasurer_account,
            transfer_record.amount,
            'CHAPTER_TO_NATIONAL_TRANSFER',
            transfer_record.id,
            v_description,
            transfer_record.initiated_by
        );
    END LOOP;
    
    RAISE NOTICE 'Chapter to national transfers migrated successfully';
END $$;

-- =====================================================
-- 5. Migrate National FS Handovers
-- =====================================================
DO $$
DECLARE
    handover_record RECORD;
    v_national_fs_account UUID;
    v_national_treasurer_account UUID;
    v_description TEXT;
BEGIN
    RAISE NOTICE 'Migrating national FS handovers...';
    
    FOR handover_record IN 
        SELECT * FROM fs_to_national_treasurer ORDER BY handed_over_at
    LOOP
        -- Get accounts
        SELECT id INTO v_national_fs_account 
        FROM accounts WHERE account_code = 'NAT-FS-CASH';
        
        SELECT id INTO v_national_treasurer_account 
        FROM accounts WHERE account_code = 'NAT-TR-CASH';
        
        -- Create description
        SELECT 'National Handover to Treasurer - ' || p.name
        INTO v_description
        FROM purposes p WHERE p.id = handover_record.purpose_id;
        
        -- Create ledger entries
        PERFORM create_ledger_entry_pair(
            v_national_treasurer_account,
            v_national_fs_account,
            handover_record.amount,
            'NATIONAL_FS_HANDOVER',
            handover_record.id,
            v_description,
            handover_record.handed_over_by
        );
    END LOOP;
    
    RAISE NOTICE 'National FS handovers migrated successfully';
END $$;

-- =====================================================
-- 6. Migrate National Bank Transactions
-- =====================================================
DO $$
DECLARE
    bank_record RECORD;
    v_national_treasurer_account UUID;
    v_national_bank_account UUID;
    v_description TEXT;
BEGIN
    RAISE NOTICE 'Migrating national bank transactions...';
    
    FOR bank_record IN 
        SELECT * FROM national_bank_transactions ORDER BY transaction_date
    LOOP
        -- Get accounts
        SELECT id INTO v_national_treasurer_account 
        FROM accounts WHERE account_code = 'NAT-TR-CASH';
        
        SELECT id INTO v_national_bank_account 
        FROM accounts WHERE account_code = 'NAT-BANK';
        
        -- Create description
        SELECT bank_record.transaction_type || ' - ' || p.name || 
               CASE WHEN bank_record.reference_number IS NOT NULL 
                    THEN ' (Ref: ' || bank_record.reference_number || ')' 
                    ELSE '' 
               END
        INTO v_description
        FROM purposes p WHERE p.id = bank_record.purpose_id;
        
        -- Create ledger entries based on transaction type
        IF bank_record.transaction_type = 'DEPOSIT' THEN
            PERFORM create_ledger_entry_pair(
                v_national_bank_account,
                v_national_treasurer_account,
                bank_record.amount,
                'NATIONAL_BANK_TRANSACTION',
                bank_record.id,
                v_description,
                bank_record.recorded_by
            );
        ELSE  -- WITHDRAWAL
            PERFORM create_ledger_entry_pair(
                v_national_treasurer_account,
                v_national_bank_account,
                bank_record.amount,
                'NATIONAL_BANK_TRANSACTION',
                bank_record.id,
                v_description,
                bank_record.recorded_by
            );
        END IF;
    END LOOP;
    
    RAISE NOTICE 'National bank transactions migrated successfully';
END $$;

-- =====================================================
-- 7. Re-enable Triggers
-- =====================================================
ALTER TABLE member_transactions ENABLE TRIGGER trg_member_transaction_ledger;
ALTER TABLE fs_to_chapter_treasurer ENABLE TRIGGER trg_fs_handover_ledger;
ALTER TABLE chapter_bank_transactions ENABLE TRIGGER trg_chapter_bank_transaction_ledger;
ALTER TABLE chapter_to_national_transfers ENABLE TRIGGER trg_chapter_to_national_transfer_ledger;
ALTER TABLE fs_to_national_treasurer ENABLE TRIGGER trg_national_fs_handover_ledger;
ALTER TABLE national_bank_transactions ENABLE TRIGGER trg_national_bank_transaction_ledger;

-- =====================================================
-- 8. Verify Migration
-- =====================================================
DO $$
DECLARE
    v_total_debits DECIMAL(15, 2);
    v_total_credits DECIMAL(15, 2);
    v_entry_count INTEGER;
BEGIN
    -- Check that debits = credits
    SELECT 
        SUM(debit_amount),
        SUM(credit_amount),
        COUNT(*)
    INTO v_total_debits, v_total_credits, v_entry_count
    FROM ledger_entries;
    
    RAISE NOTICE 'Migration Verification:';
    RAISE NOTICE '  Total Ledger Entries: %', v_entry_count;
    RAISE NOTICE '  Total Debits: %', v_total_debits;
    RAISE NOTICE '  Total Credits: %', v_total_credits;
    RAISE NOTICE '  Difference: %', v_total_debits - v_total_credits;
    
    IF v_total_debits != v_total_credits THEN
        RAISE WARNING 'DEBITS AND CREDITS DO NOT BALANCE!';
    ELSE
        RAISE NOTICE 'SUCCESS: Debits and Credits are balanced!';
    END IF;
END $$;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON SCRIPT IS 'Migrates all existing transaction data to create historical ledger entries';
