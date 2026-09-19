create table users(id text primary key,email text not null unique,password_hash text not null,nickname text not null,role text not null default 'STUDENT' check(role in ('STUDENT','ADMIN')),status text not null default 'ACTIVE' check(status in ('ACTIVE','RESTRICTED')),profile jsonb not null default '{}',created_at timestamptz not null default now());
create table dictionaries(id text primary key,kind text not null check(kind in ('buildings','courses','categories')),name_zh text not null,name_en text not null,active boolean not null default true);
create table images(id text primary key,owner_id text not null references users,storage_key text not null unique,mime_type text not null,size_bytes bigint not null,created_at timestamptz not null default now());
create table listings(id text primary key,owner_id text not null references users,title text not null,description text not null,price_minor bigint not null check(price_minor>=0),category_id text not null references dictionaries,building_id text not null references dictionaries,course_id text references dictionaries,condition_code text not null check(condition_code in ('NEW','LIKE_NEW','GOOD','FAIR')),book_author text,book_edition text,swap_enabled boolean not null default false,wanted_description text,status text not null default 'AVAILABLE' check(status in ('AVAILABLE','RESERVED','SOLD','EXCHANGED','WITHDRAWN')),moderation_status text not null default 'VISIBLE' check(moderation_status in ('VISIBLE','HIDDEN')),content_version int not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table listing_images(listing_id text references listings,image_id text unique references images,position int not null,primary key(listing_id,position));
create table conversations(id text primary key,listing_id text not null references listings,buyer_id text not null references users,seller_id text not null references users,sequence bigint not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(listing_id,buyer_id,seller_id),check(buyer_id<>seller_id));
create table messages(id text primary key,conversation_id text not null references conversations,sender_id text not null references users,client_message_id text not null,sequence bigint not null,kind text not null,body text not null,template_code text,locale text,created_at timestamptz not null default now(),unique(sender_id,client_message_id),unique(conversation_id,sequence));
create table conversation_reads(conversation_id text references conversations,user_id text references users,sequence bigint not null default 0,primary key(conversation_id,user_id));
create table trades(id text primary key,kind text not null check(kind in ('SALE','SWAP')),initiator_id text not null references users,counterparty_id text not null references users,status text not null default 'WAITING_MEETUP' check(status in ('WAITING_MEETUP','PARTIALLY_CONFIRMED','COMPLETED','CANCELLED')),meeting_location text not null,meeting_at timestamptz not null,cancel_reason text,created_at timestamptz not null default now(),completed_at timestamptz,cancelled_at timestamptz,check(initiator_id<>counterparty_id));
create table trade_items(trade_id text references trades,listing_id text references listings,giver_id text references users,receiver_id text references users,snapshot jsonb not null,primary key(trade_id,listing_id));
create table listing_reservations(listing_id text primary key references listings,trade_id text not null references trades);
create table trade_confirmations(trade_id text references trades,user_id text references users,created_at timestamptz not null default now(),primary key(trade_id,user_id));
create table swap_requests(id text primary key,proposer_id text not null references users,recipient_id text not null references users,offered_listing_id text not null references listings,requested_listing_id text not null references listings,offered_version int not null,requested_version int not null,status text not null default 'PENDING',trade_id text unique references trades,meeting_location text not null,meeting_at timestamptz not null,created_at timestamptz not null default now(),check(offered_listing_id<>requested_listing_id));
create table reviews(id text primary key,trade_id text not null references trades,author_id text not null references users,recipient_id text not null references users,rating int not null check(rating between 1 and 5),comment text,created_at timestamptz not null default now(),unique(trade_id,author_id));
create table notifications(id text primary key,user_id text not null references users,type text not null,resource_type text not null,resource_id text not null,read_at timestamptz,created_at timestamptz not null default now());
create table seasonal_zones(id text primary key,title_zh text not null,title_en text not null,description_zh text,description_en text,starts_at timestamptz not null,ends_at timestamptz not null,enabled boolean not null default true,category_id text references dictionaries,building_id text references dictionaries,check(ends_at>starts_at));
create table moderation_logs(id text primary key,actor_id text references users,target_type text not null,target_id text not null,action text not null,reason text not null,created_at timestamptz not null default now());
create table outbox_events(id text primary key,user_id text not null references users,type text not null,resource_id text not null,created_at timestamptz not null default now(),sent_at timestamptz);
create table idempotency_records(actor_id text references users,operation text not null,request_key text not null,request_hash text not null,response jsonb not null,primary key(actor_id,operation,request_key));
create index listings_search on listings(status,moderation_status,created_at,id);
create index listings_category on listings(category_id);
create index listings_building on listings(building_id);
create index listings_course on listings(course_id);
create index conversation_buyer on conversations(buyer_id,updated_at);
create index conversation_seller on conversations(seller_id,updated_at);
create index trades_initiator on trades(initiator_id,created_at);
create index trades_counterparty on trades(counterparty_id,created_at);
create index notification_owner on notifications(user_id,created_at);
create index outbox_pending on outbox_events(created_at) where sent_at is null;
insert into dictionaries values
('11111111-1111-4111-8111-111111111111','categories','教材书籍','Books',true),
('11111111-1111-4111-8111-111111111112','categories','数码设备','Electronics',true),
('11111111-1111-4111-8111-111111111113','categories','宿舍生活','Dorm living',true),
('11111111-1111-4111-8111-111111111114','categories','运动户外','Sports',true),
('22222222-2222-4222-8222-222222222221','buildings','示例宿舍A栋','Demo Hall A',true),
('22222222-2222-4222-8222-222222222222','buildings','示例宿舍B栋','Demo Hall B',true),
('22222222-2222-4222-8222-222222222223','buildings','示例图书馆','Demo Library',true),
('33333333-3333-4333-8333-333333333331','courses','高等数学','Calculus',true),
('33333333-3333-4333-8333-333333333332','courses','程序设计','Programming',true);
