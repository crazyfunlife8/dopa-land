-- ============================================================
-- 多巴樂園 Supabase Schema
-- 執行環境：Supabase SQL Editor（依序全選貼上執行）
-- 注意：Supabase Auth 已內建 auth.users，本檔不重建它
--       所有自訂表的 user_id 都 FK 指向 auth.users(id)
-- ============================================================

-- 啟用必要擴充
-- gen_random_uuid() 是 PG13+ 內建函式，不需要另外裝 uuid-ossp
create extension if not exists "pg_cron";

-- ============================================================
-- 1. users（擴充 auth.users 的公開欄位）
-- ============================================================
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('google', 'line')),
  provider_uid  text not null,
  email         text,                          -- Google 才有；不對外顯示
  display_code  char(4) not null unique,       -- 大廳代號後 4 碼，如 A7K2
  nick          varchar(20),                   -- null = 用預設代號
  nick_status   text not null default 'none'
                  check (nick_status in ('none','pending','approved','rejected')),
  type          text check (type in ('m','g','mg','p','r')),
  age_confirmed boolean not null default false,
  agreed_at     timestamptz,                   -- 📜 同意條款時間
  terms_version text,                          -- 📜 同意的條款版本
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,                   -- 📜 軟刪除；30 天後排程硬刪
  unique (provider, provider_uid)
);

-- 自動更新 updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function update_updated_at();

-- ============================================================
-- 2. birth_data（出生資料，個資等級，建議欄位加密）
-- ============================================================
create table public.birth_data (
  user_id       uuid primary key references public.users(id) on delete cascade,
  birth_date    date not null,
  birth_time    time not null,                 -- 差一小時可能差一整個類型
  birth_tz_offset numeric not null,           -- UTC offset（MVP 固定值，未來換真城市時區）
  birth_place   text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_birth_data_updated_at
  before update on public.birth_data
  for each row execute function update_updated_at();

-- ============================================================
-- 3. charts（人類圖計算結果快取）
-- ============================================================
create table public.charts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,
  authority   text not null,
  definition  text not null,
  profile     text not null,
  strategy    text not null,
  raw         jsonb not null,                  -- 完整計算結果（通道／閘門等）
  computed_at timestamptz not null default now()
);
create index idx_charts_user_id on public.charts(user_id);

-- ============================================================
-- 4. orders（訂單，交易紀錄保存 5 年）
-- ============================================================
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.users(id) on delete set null, -- 📜 帳號刪除後去識別化保留
  product             text not null check (product in ('ai_report_99','teacher_session')),
  amount              integer not null,
  currency            char(3) not null default 'TWD',
  status              text not null default 'pending'
                        check (status in ('pending','paid','failed','refunded')),
  payment_method      text check (payment_method in ('credit_card','atm','cvs')),
  provider            text,                    -- 綠界 / 藍新
  provider_trade_no   text,                    -- 對帳用
  cooling_off_ack     boolean not null,        -- 📜 「不適用七日鑑賞期」勾選，沒這個退款條款站不住腳
  consent_at          timestamptz,             -- 📜 前端 consentAt 時間戳
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index idx_orders_user_id on public.orders(user_id);
create index idx_orders_provider_trade_no on public.orders(provider_trade_no);

-- ============================================================
-- 5. entitlements（解鎖權限）
-- ============================================================
create table public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  product     text not null,                  -- 'ai_report_99'
  order_id    uuid references public.orders(id),
  granted_at  timestamptz not null default now(),
  unique (user_id, product)
);

-- ============================================================
-- 6. profiles（大廳自介，公開內容，先審後顯）
-- ============================================================
create table public.profiles (
  user_id       uuid primary key references public.users(id) on delete cascade,
  intro         varchar(100),                 -- 100 字上限
  energy_tags   text[] not null default '{}', -- 從 18 個固定清單選 1–3 個
  intro_status  text not null default 'none'
                  check (intro_status in ('none','pending','approved','rejected')),
  reject_reason text,                         -- 📜 退件要告知原因
  reviewed_by   uuid references public.users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at();

-- 有效自介的 view（給配對名單用）
create view public.approved_profiles as
  select p.*, u.type, u.nick, u.nick_status, u.display_code
  from public.profiles p
  join public.users u on u.id = p.user_id
  where p.intro_status = 'approved'
    and u.deleted_at is null
    and u.age_confirmed = true;

-- 給其他使用者看的安全欄位 view（大廳／信箱列表用）。
-- users 本表的 RLS 只放行本人 select，email/provider_uid 等敏感欄位不會透過這個 view 外洩。
create view public.public_users as
  select id, display_code, nick, nick_status, type
  from public.users
  where deleted_at is null;

-- ============================================================
-- 7. lounge_posts（樹洞紙條，先審後顯）
-- ============================================================
create table public.lounge_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  type          text not null check (type in ('m','g','mg','p','r')),
  body          varchar(100) not null,
  like_count    integer not null default 0,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  reject_reason text,                         -- 📜 退件要告知原因
  reviewed_by   uuid references public.users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index idx_lounge_posts_status on public.lounge_posts(status);

-- ============================================================
-- 8. lounge_post_likes（按讚，同帳號同張只能一次）
-- ============================================================
create table public.lounge_post_likes (
  post_id    uuid not null references public.lounge_posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 按讚時自動更新 like_count。security definer：一般使用者對 lounge_posts 沒有 UPDATE
-- 權限（貼文內容不該被使用者自己改），但 like_count 是系統維護欄位，要繞過那道限制。
create or replace function sync_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.lounge_posts set like_count = like_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.lounge_posts set like_count = greatest(like_count - 1, 0) where id = OLD.post_id;
  end if;
  return null;
end;
$$;
create trigger trg_like_count
  after insert or delete on public.lounge_post_likes
  for each row execute function sync_like_count();

-- ============================================================
-- 9. invites（想認識，雙向同意才開線）
-- ============================================================
create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id   uuid not null references public.users(id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending','accepted','declined','expired')),
  expires_at   timestamptz not null default now() + interval '7 days', -- 📜 7 天過期
  created_at   timestamptz not null default now(),
  unique (from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);
-- 📜 declined 不通知發起方——前端查詢時對 from_user 一律顯示 'pending' 直到 expires_at

-- ============================================================
-- 10. threads（對話線）
-- ============================================================
create table public.threads (
  id           uuid primary key default gen_random_uuid(),
  user_a_id    uuid not null references public.users(id) on delete cascade,
  user_b_id    uuid not null references public.users(id) on delete cascade,
  invite_id    uuid references public.invites(id),
  turn_user_id uuid not null references public.users(id), -- 輪流制：只有這人能發言
  status       text not null default 'open'
                 check (status in ('open','ended','blocked')),
  ended_by     uuid references public.users(id),
  ended_at     timestamptz,                   -- 📜 結束不通知對方
  created_at   timestamptz not null default now(),
  check (user_a_id <> user_b_id)
);
create index idx_threads_user_a on public.threads(user_a_id);
create index idx_threads_user_b on public.threads(user_b_id);

-- ============================================================
-- 11. messages（私訊，不審、無後台瀏覽介面）
-- ============================================================
-- 📜 存取權限只開給該 thread 的兩位使用者（見 RLS policy）
-- 📜 不建審核佇列、不做內容掃描、不做後台瀏覽介面
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads(id) on delete cascade,
  sender_id  uuid not null references public.users(id) on delete cascade,
  body       varchar(200) not null,
  created_at timestamptz not null default now()
);
create index idx_messages_thread_id on public.messages(thread_id);

-- 發訊後自動換輪。security definer：這支函式要能改 threads.turn_user_id，
-- 但一般使用者對 threads 只有「結束對話」的 UPDATE 權限，換輪這步要繞過該限制。
create or replace function advance_turn()
returns trigger language plpgsql security definer set search_path = public as $$
declare other_user uuid;
begin
  select case when t.user_a_id = NEW.sender_id then t.user_b_id else t.user_a_id end
  into other_user
  from public.threads t where t.id = NEW.thread_id;

  update public.threads set turn_user_id = other_user where id = NEW.thread_id;
  return NEW;
end;
$$;
create trigger trg_advance_turn
  after insert on public.messages
  for each row execute function advance_turn();

-- ============================================================
-- 12. blocks（封鎖）
-- ============================================================
create table public.blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ============================================================
-- 13. reports（檢舉，保存 2 年）
-- ============================================================
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete set null,
  reported_id uuid not null references public.users(id) on delete set null,
  thread_id   uuid references public.threads(id),
  evidence    jsonb,                           -- 📜 由檢舉人提交的對話快照，平台不回頭翻資料庫
  reason      text not null,
  status      text not null default 'open'
                check (status in ('open','actioned','dismissed')),
  action      text check (action in ('none','warn','suspend_7d','suspend_14d','ban')),
  created_at  timestamptz not null default now() -- 📜 保存 2 年
);

-- ============================================================
-- 14. line_links（LINE OA 通知綁定，若 Login + OA 同 channel 可省）
-- ============================================================
create table public.line_links (
  user_id      uuid primary key references public.users(id) on delete cascade,
  line_user_id text not null unique,
  linked_at    timestamptz not null default now()
);

-- ============================================================
-- 完整性防護：避免透過 UPDATE 竄改 threads/invites 的身分與效期欄位
-- （RLS 的 WITH CHECK 只驗證新列的欄位值，不驗證「哪些欄位被改了」，
--   所以還是要靠 trigger 擋掉不該被動到的欄位）
-- ============================================================
create or replace function guard_thread_update()
returns trigger language plpgsql as $$
begin
  if OLD.user_a_id <> NEW.user_a_id
     or OLD.user_b_id <> NEW.user_b_id
     or OLD.invite_id is distinct from NEW.invite_id
     or OLD.created_at <> NEW.created_at then
    raise exception 'threads: cannot modify identity/invite/created_at fields';
  end if;
  return NEW;
end;
$$;
create trigger trg_guard_thread_update
  before update on public.threads
  for each row execute function guard_thread_update();

create or replace function guard_invite_update()
returns trigger language plpgsql as $$
begin
  if OLD.from_user_id <> NEW.from_user_id
     or OLD.to_user_id <> NEW.to_user_id
     or OLD.expires_at <> NEW.expires_at
     or OLD.created_at <> NEW.created_at then
    raise exception 'invites: cannot modify identity/expiry/created_at fields';
  end if;
  return NEW;
end;
$$;
create trigger trg_guard_invite_update
  before update on public.invites
  for each row execute function guard_invite_update();

-- ============================================================
-- RLS（Row-Level Security）
-- ============================================================
alter table public.users            enable row level security;
alter table public.birth_data       enable row level security;
alter table public.charts           enable row level security;
alter table public.orders           enable row level security;
alter table public.entitlements     enable row level security;
alter table public.profiles         enable row level security;
alter table public.lounge_posts     enable row level security;
alter table public.lounge_post_likes enable row level security;
alter table public.invites          enable row level security;
alter table public.threads          enable row level security;
alter table public.messages         enable row level security;
alter table public.blocks           enable row level security;
alter table public.reports          enable row level security;
alter table public.line_links       enable row level security;

-- users：只有本人能讀寫完整列（含 email 等敏感欄位）。
-- 其他人要看的公開資訊（代號/暱稱/類型）一律走 public_users view，不對 users 表開放跨人 select。
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- birth_data：只有本人
create policy "birth_data_own" on public.birth_data
  for all using (auth.uid() = user_id);

-- charts：只有本人
create policy "charts_own" on public.charts
  for all using (auth.uid() = user_id);

-- orders：只有本人（交易紀錄帳號刪後仍保留，user_id 可為 null，用 service_role 讀）
create policy "orders_own" on public.orders
  for select using (auth.uid() = user_id);

-- entitlements：只有本人
create policy "entitlements_own" on public.entitlements
  for select using (auth.uid() = user_id);

-- profiles：approved 的任何人可讀；自己可讀寫
create policy "profiles_select_approved" on public.profiles
  for select using (intro_status = 'approved' or auth.uid() = user_id);
create policy "profiles_upsert_own" on public.profiles
  for all using (auth.uid() = user_id);

-- lounge_posts：approved 的所有已登入者可讀；自己可讀自己的（含 pending/rejected）
create policy "lounge_posts_select_approved" on public.lounge_posts
  for select using (status = 'approved' or auth.uid() = user_id);
create policy "lounge_posts_insert_own" on public.lounge_posts
  for insert with check (auth.uid() = user_id);

-- lounge_post_likes：自己的按讚
create policy "likes_select_all" on public.lounge_post_likes
  for select using (auth.role() = 'authenticated');
create policy "likes_own" on public.lounge_post_likes
  for all using (auth.uid() = user_id);

-- invites：發起人只能建立與讀取；只有收件人能在 pending 狀態下 accept/decline，
-- 不給 from_user 自己把自己的邀請改成 accepted。identity/效期欄位由 guard trigger 保護。
create policy "invites_select_own" on public.invites
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "invites_insert_own" on public.invites
  for insert with check (auth.uid() = from_user_id);
create policy "invites_respond_own" on public.invites
  for update
  using (auth.uid() = to_user_id and status = 'pending')
  with check (auth.uid() = to_user_id and status in ('accepted','declined'));

-- threads：只能讀自己在裡面的；不開放 client 端 INSERT
-- （對話只能在 invite 被接受時由後端用 service role 建立，對應規格書「雙向同意才開線」）。
-- UPDATE 只開放給對話中一方把 open 的對話結束，其餘欄位由 guard trigger 擋。
create policy "threads_select_own" on public.threads
  for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);
create policy "threads_end_own" on public.threads
  for update
  using (status = 'open' and (auth.uid() = user_a_id or auth.uid() = user_b_id))
  with check (status = 'ended' and ended_by = auth.uid());

-- messages：📜 thread 成員可讀全部訊息；只有輪到自己、且對話仍 open 時才能發言。
-- 沒有 UPDATE/DELETE policy——訊息一旦送出不可竄改或刪除，也沒有後台瀏覽介面。
create policy "messages_select_thread_members" on public.messages
  for select using (
    exists (
      select 1 from public.threads t
      where t.id = thread_id
        and (t.user_a_id = auth.uid() or t.user_b_id = auth.uid())
    )
  );
create policy "messages_insert_own_turn" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.status = 'open'
        and t.turn_user_id = auth.uid()
        and (t.user_a_id = auth.uid() or t.user_b_id = auth.uid())
    )
  );

-- blocks：自己的
create policy "blocks_own" on public.blocks
  for all using (auth.uid() = blocker_id);

-- reports：reporter 只能新增與讀取自己送出的檢舉，status/action（審核裁決）
-- 只能由審核端用 service role 更新，不給檢舉人自己改判決。
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reporter_id);
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = reporter_id);

-- line_links：自己的
create policy "line_links_own" on public.line_links
  for all using (auth.uid() = user_id);

-- ============================================================
-- 排程任務（pg_cron）
-- ============================================================

-- 每天凌晨 3 點：把超過 30 天的軟刪帳號硬刪（📜 隱私政策承諾）
select cron.schedule(
  'hard-delete-users',
  '0 3 * * *',
  $$
    delete from auth.users
    where id in (
      select id from public.users
      where deleted_at is not null
        and deleted_at < now() - interval '30 days'
    );
  $$
);

-- 每小時：把過期的邀請從 pending 改成 expired（📜 7 天過期）
select cron.schedule(
  'expire-invites',
  '0 * * * *',
  $$
    update public.invites
    set status = 'expired'
    where status = 'pending'
      and expires_at < now();
  $$
);

-- ============================================================
-- 補充：display_code 產生器（新建使用者時呼叫）
-- 在後端 /auth/callback 建立 users 記錄時使用
-- ============================================================
create or replace function generate_display_code()
returns char(4) language plpgsql as $$
declare
  code char(4);
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 去掉易混淆字元
begin
  loop
    code := '';
    for i in 1..4 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.users where display_code = code);
  end loop;
  return code;
end;
$$;
