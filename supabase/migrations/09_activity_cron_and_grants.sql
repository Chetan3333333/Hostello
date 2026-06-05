-- Immutable audit trail, realtime feed, inventory metadata, and safe cron.

create or replace function public.write_activity_log(
  p_hostel_id text,
  p_type text,
  p_message text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.activity_logs (
    hostel_id, type, message, actor_user_id, actor_type
  ) values (
    p_hostel_id,
    p_type,
    p_message,
    auth.uid(),
    case when auth.uid() is null then 'system' else 'owner' end
  )
$$;

create or replace function public.log_room_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_activity_log(
      new.hostel_id, 'system',
      'System: Room ' || new.number || ' was added to the hostel.'
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from 'maintenance' and new.status = 'maintenance' then
      perform public.write_activity_log(new.hostel_id, 'room', 'Room ' || new.number || ' marked under maintenance');
    elsif old.status = 'maintenance' and new.status is distinct from 'maintenance' then
      perform public.write_activity_log(new.hostel_id, 'room', 'Room ' || new.number || ' is now available');
    end if;
    if old.price is distinct from new.price then
      perform public.write_activity_log(
        new.hostel_id, 'room',
        'WARNING: Room ' || new.number || ' base rent was changed from ₹' || old.price || ' to ₹' || new.price || '.'
      );
    end if;
    if old.capacity is distinct from new.capacity then
      perform public.write_activity_log(
        new.hostel_id, 'room',
        'WARNING: Room ' || new.number || ' capacity was changed from ' || old.capacity || ' to ' || new.capacity || ' beds.'
      );
    end if;
    if old.number is distinct from new.number then
      perform public.write_activity_log(
        new.hostel_id, 'room',
        'Room ' || old.number || ' was renamed to Room ' || new.number
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_activity_log(
      old.hostel_id, 'system',
      'WARNING: Room ' || old.number || ' was permanently deleted.'
    );
    return old;
  end if;
  return null;
end
$$;

create or replace function public.log_tenant_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_activity_log(new.hostel_id, 'tenant', new.name || ' joined Room ' || new.room_number);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.room_number is distinct from new.room_number then
      perform public.write_activity_log(
        new.hostel_id, 'tenant',
        new.name || ' moved from Room ' || old.room_number || ' to Room ' || new.room_number
      );
    end if;
    if old.rent_amount is distinct from new.rent_amount then
      perform public.write_activity_log(
        new.hostel_id, 'tenant',
        'WARNING: ' || new.name || '''s monthly rent was changed from ₹' || old.rent_amount || ' to ₹' || new.rent_amount || '.'
      );
    end if;
    if old.is_active and not new.is_active then
      perform public.write_activity_log(new.hostel_id, 'tenant', new.name || ' checked out from Room ' || new.room_number);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_activity_log(
      old.hostel_id, 'system',
      'WARNING: Tenant ' || old.name || ' was permanently deleted.'
    );
    return old;
  end if;
  return null;
end
$$;

create or replace function public.log_payment_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.source = 'cron' then
      perform public.write_activity_log(
        new.hostel_id, 'system',
        'System generated rent bill of ₹' || new.amount || ' for ' || new.tenant_name || ' (' || new.month || ')'
      );
    elsif new.source = 'check_in' then
      perform public.write_activity_log(
        new.hostel_id, 'system',
        'Initial rent bill of ₹' || new.amount || ' created for ' || new.tenant_name || ' (' || new.month || ')'
      );
    elsif new.source = 'split' then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'Invoice split: New pending bill of ₹' || new.amount || ' created for ' || new.tenant_name
      );
    else
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: A manual payment record of ₹' || new.amount || ' was created for ' || new.tenant_name || '.'
      );
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from 'written_off' and new.status = 'written_off' then
      perform public.write_activity_log(new.hostel_id, 'payment', '₹' || new.amount || ' written off for ' || new.tenant_name);
    end if;
    if old.amount is distinct from new.amount
       and old.status in ('pending', 'overdue')
       and new.status in ('pending', 'overdue') then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: Unpaid bill amount for ' || new.tenant_name || ' was changed from ₹' || old.amount || ' to ₹' || new.amount || '.'
      );
    end if;
    if old.status in ('pending', 'overdue') and new.status = 'paid' then
      perform public.write_activity_log(new.hostel_id, 'payment', '₹' || new.amount || ' received from ' || new.tenant_name);
    end if;
    if old.status = 'paid' and new.status in ('pending', 'overdue') then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: Payment of ₹' || new.amount || ' undone for ' || new.tenant_name
      );
    end if;
    if old.status is distinct from 'overdue' and new.status = 'overdue' then
      perform public.write_activity_log(
        new.hostel_id, 'payment',
        'WARNING: Rent overdue for ' || new.tenant_name || ', Room ' || new.room_number
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_activity_log(
      old.hostel_id, 'payment',
      'WARNING: Payment record of ₹' || old.amount || ' for ' || old.tenant_name || ' was permanently deleted.'
    );
    return old;
  end if;
  return null;
end
$$;

create or replace function public.log_staff_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_activity_log(new.hostel_id, 'staff', new.name || ' joined the hostel staff as ' || new.role);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.balance is distinct from new.balance then
      if new.balance > old.balance then
        perform public.write_activity_log(
          new.hostel_id, 'staff',
          'Salary of ₹' || (new.balance - old.balance) || ' added for ' || new.name
        );
      else
        perform public.write_activity_log(
          new.hostel_id, 'staff',
          'Cash payment of ₹' || (old.balance - new.balance) || ' recorded for ' || new.name
        );
      end if;
    end if;
    if old.salary is distinct from new.salary then
      perform public.write_activity_log(
        new.hostel_id, 'staff',
        'WARNING: ' || new.name || '''s monthly salary was changed from ₹' || old.salary || ' to ₹' || new.salary || '.'
      );
    end if;
    if old.status is distinct from new.status then
      perform public.write_activity_log(new.hostel_id, 'staff', new.name || ' was marked as ' || new.status);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_activity_log(
      old.hostel_id, 'staff',
      'WARNING: Staff member ' || old.name || ' was permanently removed.'
    );
    return old;
  end if;
  return null;
end
$$;

drop trigger if exists trigger_room_activity on public.rooms;
create trigger trigger_room_activity
after insert or update or delete on public.rooms
for each row execute function public.log_room_activity();

drop trigger if exists trigger_tenant_activity on public.tenants;
create trigger trigger_tenant_activity
after insert or update or delete on public.tenants
for each row execute function public.log_tenant_activity();

drop trigger if exists trigger_payment_activity on public.payments;
create trigger trigger_payment_activity
after insert or update or delete on public.payments
for each row execute function public.log_payment_activity();

drop trigger if exists trigger_staff_activity on public.staff;
create trigger trigger_staff_activity
after insert or update or delete on public.staff
for each row execute function public.log_staff_activity();

create or replace function public.sync_hostel_total_rooms()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_hostel_id text;
begin
  affected_hostel_id := coalesce(new.hostel_id, old.hostel_id);

  update public.hostels h
  set total_rooms = (
    select count(*)::integer
    from public.rooms r
    where r.hostel_id = h.id
      and not r.is_archived
  )
  where h.id = affected_hostel_id;

  if tg_op = 'UPDATE' and old.hostel_id is distinct from new.hostel_id then
    update public.hostels h
    set total_rooms = (
      select count(*)::integer
      from public.rooms r
      where r.hostel_id = h.id
        and not r.is_archived
    )
    where h.id = old.hostel_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists trigger_sync_hostel_total_rooms on public.rooms;
create trigger trigger_sync_hostel_total_rooms
after insert or delete or update of hostel_id, is_archived on public.rooms
for each row execute function public.sync_hostel_total_rooms();

create or replace function public.process_daily_payments()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_ist_date date := timezone('Asia/Kolkata', now())::date;
  current_month_str text := to_char(current_ist_date, 'YYYY-MM');
begin
  update public.payments
  set status = 'overdue'
  where status = 'pending'
    and current_ist_date > due_date;

  if extract(day from current_ist_date) = 1 then
    insert into public.payments (
      id, tenant_id, tenant_name, room_number, amount, month, due_date,
      status, hostel_id, receipt_note, source, is_remainder
    )
    select
      'pay-cron-' || t.id || '-' || current_month_str,
      t.id,
      t.name,
      t.room_number,
      t.rent_amount,
      current_month_str,
      (current_month_str || '-10')::date,
      'pending',
      t.hostel_id,
      'Automated monthly rent for ' || current_month_str,
      'cron',
      false
    from public.tenants t
    where t.is_active
      and not exists (
        select 1
        from public.payments p
        where p.tenant_id = t.id
          and p.month = current_month_str
          and not p.is_remainder
      );
  end if;
end
$$;

create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'daily_payment_automation'
  ) then
    perform cron.schedule(
      'daily_payment_automation',
      '30 18 * * *',
      'select public.process_daily_payments()'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_logs'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end
$$;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_owner_hostel_id() to authenticated;
grant execute on function public.add_tenant_transaction(jsonb, jsonb, jsonb, text) to authenticated;
grant execute on function public.update_room_transaction(text, jsonb, boolean) to authenticated;
grant execute on function public.update_tenant_transaction(text, jsonb, boolean, text, text, integer, integer, text, text, text, boolean, numeric, text) to authenticated;
grant execute on function public.swap_tenants_transaction(text, text, text, text, numeric, text, text, numeric, text) to authenticated;
grant execute on function public.checkout_tenant_transaction(text, text, text, integer, text) to authenticated;
grant execute on function public.record_payment_transaction(text, numeric, date, jsonb) to authenticated;
grant execute on function public.adjust_staff_balance(text, numeric, text) to authenticated;
grant execute on function public.get_activity_logs_page(timestamptz, uuid, integer) to authenticated;
grant execute on function public.process_daily_payments() to service_role;
