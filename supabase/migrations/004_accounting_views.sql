-- =====================================================
-- SWEFA Accounting Views
-- Reporting and Balance Query Views
-- =====================================================

-- =====================================================
-- 1. VIEW: Account Balances with Details
-- =====================================================
CREATE OR REPLACE VIEW v_account_balances AS
SELECT 
    a.id AS account_id,
    a.account_code,
    a.name AS account_name,
    at.name AS account_type,
    at.normal_balance,
    c.name AS chapter_name,
    p.name AS purpose_name,
    ab.current_balance,
    ab.total_debits,
    ab.total_credits,
    ab.last_updated,
    a.is_system_account
FROM accounts a
JOIN account_types at ON a.account_type_id = at.id
LEFT JOIN chapters c ON a.chapter_id = c.id
LEFT JOIN purposes p ON a.purpose_id = p.id
LEFT JOIN account_balances ab ON a.id = ab.account_id
WHERE a.is_active = TRUE;

-- =====================================================
-- 2. VIEW: Chapter Cash Position
-- =====================================================
CREATE OR REPLACE VIEW v_chapter_cash_position AS
SELECT 
    c.id AS chapter_id,
    c.name AS chapter_name,
    c.code AS chapter_code,
    MAX(CASE WHEN a.account_code LIKE '%-FS-CASH' THEN ab.current_balance ELSE 0 END) AS fs_cash_balance,
    MAX(CASE WHEN a.account_code LIKE '%-TR-CASH' THEN ab.current_balance ELSE 0 END) AS treasurer_cash_balance,
    MAX(CASE WHEN a.account_code LIKE '%-BANK' THEN ab.current_balance ELSE 0 END) AS bank_balance,
    MAX(CASE WHEN a.account_code LIKE '%-FS-CASH' THEN ab.current_balance ELSE 0 END) +
    MAX(CASE WHEN a.account_code LIKE '%-TR-CASH' THEN ab.current_balance ELSE 0 END) +
    MAX(CASE WHEN a.account_code LIKE '%-BANK' THEN ab.current_balance ELSE 0 END) AS total_cash_position
FROM chapters c
LEFT JOIN accounts a ON c.id = a.chapter_id AND a.is_system_account = TRUE
LEFT JOIN account_balances ab ON a.id = ab.account_id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.code;

-- =====================================================
-- 3. VIEW: National Cash Position
-- =====================================================
CREATE OR REPLACE VIEW v_national_cash_position AS
SELECT 
    MAX(CASE WHEN a.account_code = 'NAT-FS-CASH' THEN ab.current_balance ELSE 0 END) AS national_fs_cash,
    MAX(CASE WHEN a.account_code = 'NAT-TR-CASH' THEN ab.current_balance ELSE 0 END) AS national_treasurer_cash,
    MAX(CASE WHEN a.account_code = 'NAT-BANK' THEN ab.current_balance ELSE 0 END) AS national_bank_balance,
    MAX(CASE WHEN a.account_code = 'NAT-FS-CASH' THEN ab.current_balance ELSE 0 END) +
    MAX(CASE WHEN a.account_code = 'NAT-TR-CASH' THEN ab.current_balance ELSE 0 END) +
    MAX(CASE WHEN a.account_code = 'NAT-BANK' THEN ab.current_balance ELSE 0 END) AS total_national_cash
FROM accounts a
LEFT JOIN account_balances ab ON a.id = ab.account_id
WHERE a.chapter_id IS NULL AND a.is_system_account = TRUE;

-- =====================================================
-- 4. VIEW: Audit Trail
-- =====================================================
CREATE OR REPLACE VIEW v_audit_trail AS
SELECT 
    le.id AS ledger_entry_id,
    le.transaction_date,
    le.journal_id,
    le.reference_type,
    le.reference_id,
    a.account_code,
    a.name AS account_name,
    at.name AS account_type,
    le.debit_amount,
    le.credit_amount,
    le.description,
    le.notes,
    c.name AS chapter_name,
    p.name AS purpose_name,
    u.email AS created_by_email,
    le.created_at,
    le.is_reversed
FROM ledger_entries le
JOIN accounts a ON le.account_id = a.id
JOIN account_types at ON a.account_type_id = at.id
LEFT JOIN chapters c ON a.chapter_id = c.id
LEFT JOIN purposes p ON a.purpose_id = p.id
LEFT JOIN auth.users u ON le.created_by = u.id
ORDER BY le.transaction_date DESC, le.journal_id, le.id;

-- =====================================================
-- 5. VIEW: Purpose Revenue Summary (Chapter Level)
-- =====================================================
CREATE OR REPLACE VIEW v_chapter_purpose_revenue AS
SELECT 
    c.id AS chapter_id,
    c.name AS chapter_name,
    p.id AS purpose_id,
    p.name AS purpose_name,
    a.id AS account_id,
    ab.current_balance AS total_revenue,
    ab.total_credits AS total_contributions,
    ab.last_updated
FROM chapters c
CROSS JOIN purposes p
LEFT JOIN accounts a ON c.id = a.chapter_id AND p.id = a.purpose_id
LEFT JOIN account_balances ab ON a.id = ab.account_id
WHERE c.is_active = TRUE 
  AND p.is_active = TRUE 
  AND p.level = 'CHAPTER'
ORDER BY c.name, p.name;

-- =====================================================
-- 6. VIEW: Updated Chapter Reconciliation
-- =====================================================
CREATE OR REPLACE VIEW v_chapter_reconciliation_new AS
WITH fs_handovers AS (
    SELECT 
        chapter_id,
        purpose_id,
        SUM(amount) AS total_handed_over
    FROM fs_to_chapter_treasurer
    GROUP BY chapter_id, purpose_id
),
treasurer_receipts AS (
    SELECT 
        chapter_id,
        purpose_id,
        SUM(amount_received) AS total_received
    FROM chapter_treasurer_receipts
    GROUP BY chapter_id, purpose_id
)
SELECT 
    c.id AS chapter_id,
    c.name AS chapter_name,
    p.id AS purpose_id,
    p.name AS purpose_name,
    COALESCE(fh.total_handed_over, 0) AS fs_handed_over,
    COALESCE(tr.total_received, 0) AS treasurer_received,
    COALESCE(fh.total_handed_over, 0) - COALESCE(tr.total_received, 0) AS difference
FROM chapters c
CROSS JOIN purposes p
LEFT JOIN fs_handovers fh ON c.id = fh.chapter_id AND p.id = fh.purpose_id
LEFT JOIN treasurer_receipts tr ON c.id = tr.chapter_id AND p.id = tr.purpose_id
WHERE c.is_active = TRUE 
  AND p.is_active = TRUE
  AND (fh.total_handed_over IS NOT NULL OR tr.total_received IS NOT NULL)
ORDER BY c.name, p.name;

-- =====================================================
-- 7. VIEW: Transaction Summary by Journal
-- =====================================================
CREATE OR REPLACE VIEW v_transaction_summary AS
SELECT 
    le.journal_id,
    le.reference_type,
    le.reference_id,
    MIN(le.transaction_date) AS transaction_date,
    MIN(le.description) AS description,
    SUM(le.debit_amount) AS total_debits,
    SUM(le.credit_amount) AS total_credits,
    CASE 
        WHEN SUM(le.debit_amount) = SUM(le.credit_amount) THEN TRUE 
        ELSE FALSE 
    END AS is_balanced,
    COUNT(*) AS entry_count,
    MIN(u.email) AS created_by_email,
    MIN(le.created_at) AS created_at
FROM ledger_entries le
LEFT JOIN auth.users u ON le.created_by = u.id
WHERE le.is_reversed = FALSE
GROUP BY le.journal_id, le.reference_type, le.reference_id
ORDER BY MIN(le.transaction_date) DESC;

-- =====================================================
-- 8. VIEW: Cash Flow Statement (Chapter)
-- =====================================================
CREATE OR REPLACE VIEW v_chapter_cash_flow AS
SELECT 
    c.id AS chapter_id,
    c.name AS chapter_name,
    DATE_TRUNC('month', le.transaction_date) AS month,
    
    -- Cash inflows
    SUM(CASE 
        WHEN a.account_code LIKE '%-FS-CASH' AND le.debit_amount > 0 THEN le.debit_amount 
        ELSE 0 
    END) AS fs_cash_inflow,
    
    -- Cash outflows
    SUM(CASE 
        WHEN a.account_code LIKE '%-FS-CASH' AND le.credit_amount > 0 THEN le.credit_amount 
        ELSE 0 
    END) AS fs_cash_outflow,
    
    -- Net cash flow
    SUM(CASE 
        WHEN a.account_code LIKE '%-FS-CASH' THEN le.debit_amount - le.credit_amount 
        ELSE 0 
    END) AS fs_net_cash_flow
    
FROM ledger_entries le
JOIN accounts a ON le.account_id = a.id
JOIN chapters c ON a.chapter_id = c.id
WHERE le.is_reversed = FALSE
  AND c.is_active = TRUE
GROUP BY c.id, c.name, DATE_TRUNC('month', le.transaction_date)
ORDER BY c.name, month DESC;

-- =====================================================
-- 9. FUNCTION: Get Account Balance at Date
-- =====================================================
CREATE OR REPLACE FUNCTION get_account_balance_at_date(
    p_account_id UUID,
    p_date TIMESTAMP WITH TIME ZONE
)
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
    
    -- Calculate totals up to specified date
    SELECT 
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO v_total_debits, v_total_credits
    FROM ledger_entries
    WHERE account_id = p_account_id
    AND transaction_date <= p_date
    AND is_reversed = FALSE;
    
    -- Calculate balance based on normal balance
    IF v_normal_balance = 'DEBIT' THEN
        v_balance := v_total_debits - v_total_credits;
    ELSE
        v_balance := v_total_credits - v_total_debits;
    END IF;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON VIEW v_account_balances IS 'Detailed view of all account balances with chapter and purpose information';
COMMENT ON VIEW v_chapter_cash_position IS 'Summary of cash positions (FS, Treasurer, Bank) for each chapter';
COMMENT ON VIEW v_national_cash_position IS 'Summary of national-level cash positions';
COMMENT ON VIEW v_audit_trail IS 'Complete audit trail of all ledger entries with source transaction details';
COMMENT ON VIEW v_chapter_purpose_revenue IS 'Revenue collected per purpose per chapter';
COMMENT ON VIEW v_transaction_summary IS 'Summary of transactions grouped by journal ID';
COMMENT ON VIEW v_chapter_cash_flow IS 'Monthly cash flow statement for chapters';
COMMENT ON FUNCTION get_account_balance_at_date IS 'Returns the account balance as of a specific date';
