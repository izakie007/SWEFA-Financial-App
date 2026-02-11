# SWEFA Accounting Migrations

This directory contains SQL migration files for implementing double-entry bookkeeping in the SWEFA financial application.

## Migration Files (Run in Order)

### 001_accounting_schema.sql
**Core Accounting Tables**
- Creates `account_types`, `accounts`, `ledger_entries`, `account_balances` tables
- Implements balance calculation and validation functions
- Sets up auto-update triggers for account balances

### 002_seed_accounts.sql
**Initialize System Accounts**
- Creates FS Cash, Treasurer Cash, and Bank accounts for all chapters
- Creates purpose revenue accounts for all chapter-purpose combinations
- Creates national-level accounts
- Sets up triggers to auto-create accounts for new chapters/purposes

### 003_accounting_triggers.sql
**Double-Entry Bookkeeping Triggers**
- Automatically creates ledger entries for:
  - Member transactions (DEBIT: FS Cash, CREDIT: Purpose Revenue)
  - FS handovers (DEBIT: Treasurer Cash, CREDIT: FS Cash)
  - Bank transactions (deposits/withdrawals)
  - Chapter to National transfers
  - National handovers and bank transactions
- Validates sufficient funds before transactions

### 004_accounting_views.sql
**Reporting Views**
- `v_account_balances` - All account balances with details
- `v_chapter_cash_position` - FS, Treasurer, Bank balances per chapter
- `v_national_cash_position` - National cash positions
- `v_audit_trail` - Complete transaction audit trail
- `v_chapter_purpose_revenue` - Revenue by purpose
- `v_transaction_summary` - Transaction summaries by journal
- `v_chapter_cash_flow` - Monthly cash flow statements

### 005_migrate_existing_data.sql
**Backfill Historical Data**
- Processes all existing transactions to create ledger entries
- Migrates member transactions, handovers, bank transactions, transfers
- Verifies that debits = credits after migration

### 006_accounting_rls.sql
**Row Level Security (RLS) and Hardening**
- Applies Row Level Security (RLS) policies to accounting tables (`accounts`, `ledger_entries`, `account_balances`) to ensure users can only access data relevant to their chapter or national role.
- Hardens accounting functions by restricting direct manipulation of sensitive data and enforcing data integrity.

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy and paste each migration file content in order (001 → 005)
5. Run each migration
6. Verify success messages

### Option 2: Supabase CLI
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref xzxfcfdjbyiuxojrtizx

# Run migrations
supabase db push
```

### Option 3: Direct PostgreSQL Connection
```bash
# Using psql (replace with your connection string)
psql "postgresql://postgres:[YOUR-PASSWORD]@db.xzxfcfdjbyiuxojrtizx.supabase.co:5432/postgres" -f supabase/migrations/001_accounting_schema.sql
psql "postgresql://postgres:[YOUR-PASSWORD]@db.xzxfcfdjbyiuxojrtizx.supabase.co:5432/postgres" -f supabase/migrations/002_seed_accounts.sql
# ... continue for all files
```

## Verification After Migration

### 1. Check Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('account_types', 'accounts', 'ledger_entries', 'account_balances');
```

### 2. Verify Accounts Created
```sql
SELECT COUNT(*) as account_count FROM accounts;
SELECT * FROM accounts WHERE is_system_account = TRUE LIMIT 10;
```

### 3. Check Ledger Entries Balance
```sql
SELECT 
    SUM(debit_amount) as total_debits,
    SUM(credit_amount) as total_credits,
    SUM(debit_amount) - SUM(credit_amount) as difference
FROM ledger_entries;
-- difference should be 0
```

### 4. View Account Balances
```sql
SELECT * FROM v_chapter_cash_position;
SELECT * FROM v_national_cash_position;
```

### 5. Test New Transaction
```sql
-- This should automatically create ledger entries
INSERT INTO member_transactions (
    member_id, purpose_id, amount, transaction_type, 
    destination, chapter_id, recorded_by, transaction_date
) VALUES (
    '<member_id>', '<purpose_id>', 1000, 'COLLECTION', 
    'CHAPTER', '<chapter_id>', '<user_id>', NOW()
);

-- Verify ledger entries were created
SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 2;
```

## Rollback (If Needed)

```sql
-- Disable triggers first
ALTER TABLE member_transactions DISABLE TRIGGER trg_member_transaction_ledger;
ALTER TABLE fs_to_chapter_treasurer DISABLE TRIGGER trg_fs_handover_ledger;
ALTER TABLE chapter_bank_transactions DISABLE TRIGGER trg_chapter_bank_transaction_ledger;
ALTER TABLE chapter_to_national_transfers DISABLE TRIGGER trg_chapter_to_national_transfer_ledger;
ALTER TABLE fs_to_national_treasurer DISABLE TRIGGER trg_national_fs_handover_ledger;
ALTER TABLE national_bank_transactions DISABLE TRIGGER trg_national_bank_transaction_ledger;

-- Drop tables (in reverse order)
DROP TABLE IF EXISTS account_balances CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS account_types CASCADE;

-- Drop views
DROP VIEW IF EXISTS v_account_balances CASCADE;
DROP VIEW IF EXISTS v_chapter_cash_position CASCADE;
DROP VIEW IF EXISTS v_national_cash_position CASCADE;
DROP VIEW IF EXISTS v_audit_trail CASCADE;
DROP VIEW IF EXISTS v_chapter_purpose_revenue CASCADE;
DROP VIEW IF EXISTS v_transaction_summary CASCADE;
DROP VIEW IF EXISTS v_chapter_cash_flow CASCADE;
```

## Troubleshooting

### Error: "Account not found"
- Ensure `002_seed_accounts.sql` ran successfully
- Check that all chapters and purposes have corresponding accounts

### Error: "Insufficient funds"
- This is expected behavior! The system is now validating balances
- Check account balances before attempting transactions
- Use `v_chapter_cash_position` to see current balances

### Debits != Credits
- Run the verification query from `005_migrate_existing_data.sql`
- Check for any failed migrations
- Review ledger entries for the problematic transaction

## Support

For issues or questions:
1. Check the implementation plan: `implementation_plan.md`
2. Review the verification steps above
3. Check Supabase logs for error messages
