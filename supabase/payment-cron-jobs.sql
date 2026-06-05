-- Run this script in your Supabase Dashboard -> SQL Editor

alter table public.payments
add column if not exists source text not null default 'manual',
add column if not exists is_remainder boolean not null default false;

-- 1. Enable the pg_cron extension (This allows background scheduled tasks)
create extension if not exists pg_cron;

-- 2. Create the core logic function
-- This function contains all the business logic and handles the Timezone safely
create or replace function public.process_daily_payments()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    -- Calculate current time in India Standard Time (IST)
    current_ist_timestamp timestamp := timezone('Asia/Kolkata', now());
    current_ist_date date := current_ist_timestamp::date;
    current_month_str text := to_char(current_ist_date, 'YYYY-MM');
begin
    -- JOB 1: Mark pending payments as overdue if it's strictly past the 10th of the month
    -- We extract the month from the payment row and compare it to the 10th of that month.
    update public.payments 
    set status = 'overdue' 
    where status = 'pending' 
    and current_ist_date > due_date;

    -- JOB 2: On the 1st of the month, generate new invoices for all active tenants
    if extract(day from current_ist_date) = 1 then
        insert into public.payments (
            id,
            tenant_id, 
            tenant_name, 
            room_number, 
            amount, 
            month, 
            due_date, 
            status, 
            hostel_id,
            receipt_note,
            source,
            is_remainder
        )
        select 
            'pay-cron-' || id || '-' || current_month_str,
            id, 
            name, 
            room_number, 
            rent_amount, 
            current_month_str, 
            (current_month_str || '-10')::date, -- Due strictly on the 10th
            'pending', 
            hostel_id,
            'Automated monthly rent for ' || current_month_str,
            'cron',
            false
        from public.tenants
        where is_active = true
        -- CRITICAL: Prevent duplicate insertions if the job accidentally runs twice on the 1st
        and not exists (
            select 1 from public.payments p 
            where p.tenant_id = tenants.id
              and p.month = current_month_str
              and not p.is_remainder
        );
    end if;
end;
$$;

-- 3. Schedule the Cron Job
-- Schedule it to run at 18:30 UTC every day.
-- Since IST is UTC+5:30, 18:30 UTC exactly equals 12:00 AM Midnight in India.
do $$
begin
    if not exists (select 1 from cron.job where jobname = 'daily_payment_automation') then
        perform cron.schedule(
            'daily_payment_automation',
            '30 18 * * *',
            'select public.process_daily_payments()'
        );
    end if;
end;
$$;

revoke execute on function public.process_daily_payments() from public, anon, authenticated;
grant execute on function public.process_daily_payments() to service_role;
