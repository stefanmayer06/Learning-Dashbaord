-- Row-level-security checks. Any failed expectation raises and aborts.
\set ON_ERROR_STOP on
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

insert into public.learner_profiles (user_id, display_name) values ('11111111-1111-1111-1111-111111111111', 'Ada');
insert into public.step_progress (user_id, course_id, step_id, score)
  values ('11111111-1111-1111-1111-111111111111', 'quantum-trading-101', 'qt-orient-reel', 1);
insert into public.lab_captures (user_id, course_id, capture_key, summary, payload)
  values ('11111111-1111-1111-1111-111111111111', 'quantum-trading-101', 'portfolio-run', 'GOVT+VALU+GOLD', '{"p":0.31}');
insert into public.work_outputs (user_id, course_id, output_id, fields)
  values ('11111111-1111-1111-1111-111111111111', 'quantum-trading-101', 'readiness-brief', '{"verdict":"wait"}');
insert into public.certificates (id, user_id, course_id, learner_name, course_title, course_version)
  values ('MRG-QT101-ABCD-2345', '11111111-1111-1111-1111-111111111111', 'quantum-trading-101', 'Ada', 'Quantum Trading 101', '1.0.0');

-- upsert path used by the app
insert into public.step_progress (user_id, course_id, step_id, score)
  values ('11111111-1111-1111-1111-111111111111', 'quantum-trading-101', 'qt-orient-reel', 0.5)
  on conflict (user_id, course_id, step_id) do update set score = excluded.score;

do $$ begin
  begin
    insert into public.step_progress (user_id, course_id, step_id)
      values ('22222222-2222-2222-2222-222222222222', 'quantum-trading-101', 'x');
    raise exception 'FAIL: inserted a row for another user';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.certificates set learner_name = 'Mallory' where id = 'MRG-QT101-ABCD-2345';
    raise exception 'FAIL: certificate was editable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.step_progress (user_id, course_id, step_id)
      values ('11111111-1111-1111-1111-111111111111', 'Bad Id!', 'x');
    raise exception 'FAIL: malformed course id accepted';
  exception when check_violation then null;
  end;
  -- certificate re-push from another device is a no-op, not an error
  insert into public.certificates (id, user_id, course_id, learner_name, course_title, course_version)
    values ('MRG-QT101-ABCD-2345', '11111111-1111-1111-1111-111111111111', 'quantum-trading-101', 'Ada', 'Quantum Trading 101', '1.0.0')
    on conflict (id) do nothing;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare n int;
begin
  select (select count(*) from public.step_progress) + (select count(*) from public.lab_captures)
       + (select count(*) from public.work_outputs) + (select count(*) from public.certificates)
       + (select count(*) from public.learner_profiles) into n;
  if n <> 0 then raise exception 'FAIL: user 2 can see % of user 1''s rows', n; end if;
  update public.step_progress set score = 0 where true;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user 2 updated user 1''s rows'; end if;
  delete from public.work_outputs where true;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user 2 deleted user 1''s rows'; end if;
end $$;

reset role;
set role anon;
do $$
declare r record;
begin
  select * into r from public.verify_certificate('MRG-QT101-ABCD-2345');
  if r.learner_name is distinct from 'Ada' then raise exception 'FAIL: public verification did not find the credential'; end if;
  begin
    perform 1 from public.step_progress;
    raise exception 'FAIL: anon can read progress';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
declare s real;
begin
  select score into s from public.step_progress where step_id = 'qt-orient-reel';
  if s <> 0.5 then raise exception 'FAIL: upsert did not update (score=%)', s; end if;
end $$;
select 'RLS tests passed' as result;
