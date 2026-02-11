-- =====================================================
-- SWEFA Accounting Schema - Core Tables
-- Double-Entry Bookkeeping System
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ACCOUNT TYPES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS account_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert standard account types
INSERT INTO account_types (name, normal_balance, description) VALUES
    ('ASSET', 'DEBIT', 'Resources owned (Cash, Bank, Receivables)'),
    ('LIABILITY', 'CREDIT', 'Obligations owed (Payables, Loans)'),
    ('EQUITY', 'CREDIT', 'Owner''s equity and retained earnings'),
    ('REVENUE', 'CREDIT', 'Income from member contributions'),
    ('EXPENSE', 'DEBIT', 'Costs incurred for operations')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. ACCOUNTS TABLE (Chart of Accounts)
-- =====================================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    account_type_id UUID NOT NULL REFERENCES account_types(id),
    
    -- Organizational hierarchy
    chapter_id UUID REFERENCES chapters(id),  -- NULL for national accounts
    purpose_id UUID REFERENCES purposes(id),  -- NULL for general accounts
    
    -- Account classification
    is_system_account BOOLEAN DEFAULT FALSE,  -- System accounts (FS Cash, Treasurer Cash, Bank)
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_chapter_purpose_account UNIQUE (chapter_id, purpose_id, account_code)
);

-- Create indexes for performance
CREATE INDEX idx_accounts_chapter ON accounts(chapter_id);
CREATE INDEX idx_accounts_purpose ON accounts(purpose_id);
CREATE INDEX idx_accounts_type ON accounts(account_type_id);
CREATE INDEX idx_accounts_active ON accounts(is_active);

-- =====================================================
-- 3. LEDGER ENTRIES TABLE (General Ledger)
-- =====================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Transaction details
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    
    -- Double-entry amounts (only one should be non-zero per entry)
    debit_amount DECIMAL(15, 2) DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount DECIMAL(15, 2) DEFAULT 0 CHECK (credit_amount >= 0),
    
    -- Ensure only debit OR credit, not both
    CONSTRAINT check_debit_or_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    ),
    
    -- Reference to source transaction
    reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN (
        'MEMBER_TRANSACTION',
        'FS_HANDOVER',
        'BANK_TRANSACTION',
        'CHAPTER_TO_NATIONAL_TRANSFER',
        'NATIONAL_FS_HANDOVER',
        'NATIONAL_BANK_TRANSACTION',
        'ADJUSTMENT'
    )),
    reference_id UUID NOT NULL,
    
    -- Transaction grouping (all entries for one transaction share same journal_id)
    journal_id UUID NOT NULL,
    
    -- Description and notes
    description TEXT,
    notes TEXT,
    
    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Metadata
    is_reversed BOOLEAN DEFAULT FALSE,
    reversed_by UUID REFERENCES ledger_entries(journal_id)
);

-- Create indexes for performance
CREATE INDEX idx_ledger_account ON ledger_entries(account_id);
CREATE INDEX idx_ledger_date ON ledger_entries(transaction_date);
CREATE INDEX idx_ledger_reference ON ledger_entries(reference_type, reference_id);
CREATE INDEX idx_ledger_journal ON ledger_entries(journal_id);
CREATE INDEX idx_ledger_created_by ON ledger_entries(created_by);

-- =====================================================
-- 4. ACCOUNT BALANCES TABLE (Materialized Balances)
-- =====================================================
CREATE TABLE IF NOT EXISTS account_balances (
    account_id UUID PRIMARY KEY REFERENCES accounts(id),
    
    -- Current balance (computed based on account type)
    current_balance DECIMAL(15, 2) DEFAULT 0,
    
    -- Component totals
    total_debits DECIMAL(15, 2) DEFAULT 0,
    total_credits DECIMAL(15, 2) DEFAULT 0,
    
    -- Metadata
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_transaction_id UUID REFERENCES ledger_entries(id)
);

-- Create index for performance
CREATE INDEX idx_account_balances_updated ON account_balances(last_updated);

-- =====================================================
-- 5. FUNCTION: Calculate Account Balance
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_account_balance(p_account_id UUID)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
    v_account_type VARCHAR(50);
    v_normal_balance VARCHAR(10);
    v_total_debits DECIMAL(15, 2);
    v_total_credits DECIMAL(15, 2);
    v_balance DECIMAL(15, 2);
BEGIN
    -- Get account type and normal balance
    SELECT at.name, at.normal_balance
    INTO v_account_type, v_normal_balance
    FROM accounts a
    JOIN account_types at ON a.account_type_id = at.id
    WHERE a.id = p_account_id;
    
    -- Calculate totals
    SELECT 
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO v_total_debits, v_total_credits
    FROM ledger_entries
    WHERE account_id = p_account_id
    AND is_reversed = FALSE;
    
    -- Calculate balance based on normal balance
    IF v_normal_balance = 'DEBIT' THEN
        -- Assets, Expenses: Debits increase, Credits decrease
        v_balance := v_total_debits - v_total_credits;
    ELSE
        -- Liabilities, Equity, Revenue: Credits increase, Debits decrease
        v_balance := v_total_credits - v_total_debits;
    END IF;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. FUNCTION: Update Account Balance
-- =====================================================
CREATE OR REPLACE FUNCTION update_account_balance(p_account_id UUID)
RETURNS VOID AS $$
DECLARE
    v_balance DECIMAL(15, 2);
    v_total_debits DECIMAL(15, 2);
    v_total_credits DECIMAL(15, 2);
BEGIN
    -- Calculate totals
    SELECT 
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO v_total_debits, v_total_credits
    FROM ledger_entries
    WHERE account_id = p_account_id
    AND is_reversed = FALSE;
    
    -- Calculate balance
    v_balance := calculate_account_balance(p_account_id);
    
    -- Upsert into account_balances
    INSERT INTO account_balances (account_id, current_balance, total_debits, total_credits, last_updated)
    VALUES (p_account_id, v_balance, v_total_debits, v_total_credits, NOW())
    ON CONFLICT (account_id) 
    DO UPDATE SET
        current_balance = v_balance,
        total_debits = v_total_debits,
        total_credits = v_total_credits,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. TRIGGER: Auto-update account balance on ledger entry
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update balance for the affected account
    PERFORM update_account_balance(NEW.account_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entry_balance_update
AFTER INSERT OR UPDATE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION trigger_update_account_balance();

-- =====================================================
-- 8. FUNCTION: Validate Sufficient Funds
-- =====================================================
CREATE OR REPLACE FUNCTION check_sufficient_funds(
    p_account_id UUID,
    p_amount DECIMAL(15, 2)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance DECIMAL(15, 2);
BEGIN
    -- Get current balance
    SELECT current_balance INTO v_current_balance
    FROM account_balances
    WHERE account_id = p_account_id;
    
    -- If no balance record exists, assume 0
    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;
    
    -- Check if sufficient funds
    RETURN v_current_balance >= p_amount;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE account_types IS 'Standard accounting account types (Asset, Liability, Equity, Revenue, Expense)';
COMMENT ON TABLE accounts IS 'Chart of accounts - all accounts in the system organized by chapter and purpose';
COMMENT ON TABLE ledger_entries IS 'General ledger - all financial transactions using double-entry bookkeeping';
COMMENT ON TABLE account_balances IS 'Materialized account balances for performance';
COMMENT ON FUNCTION calculate_account_balance IS 'Calculates the current balance of an account based on its type and ledger entries';
COMMENT ON FUNCTION update_account_balance IS 'Updates the materialized balance for an account';
COMMENT ON FUNCTION check_sufficient_funds IS 'Validates if an account has sufficient funds for a transaction';
