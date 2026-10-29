-- Active: 1793274436530@@127.0.0.1@5432@noty
create table users(
    id uuid primary key default gen_random_uuid(),
    username varchar(255) unique not null,
    email varchar(255) unique not null,
    password_hash varchar(60) not null,
    created_at timestamptz default now(),
    updated_at timestamptz
);

create table tags(
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    name varchar(255) not null
);

create table projects(
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    tag_id uuid references tags(id) on delete set null,
    title varchar(255) not null,
    description text
);

create table notes(
    id uuid primary key default gen_random_uuid(),
    project_id uuid references projects(id) on delete set null,
    user_id uuid not null references users(id) on delete cascade,
    title varchar(255) not null,
    description text,
    created_at timestamptz default now(),
    updated_at timestamptz
);

create table note_section(
    id uuid primary key default gen_random_uuid(),
    note_id uuid not null references notes(id) on delete cascade,
    note_order integer default 1 check(note_order > 0),
    content text,
    created_at timestamptz default now(),
    updated_at timestamptz
);

create table refresh_tokens(
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash varchar(64) unique not null,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    user_agent varchar(255),
    ip_address inet,
    created_at timestamptz default now()
);

create index idx_refresh_tokens_user_id on refresh_tokens(user_id)
    where revoked_at is null;