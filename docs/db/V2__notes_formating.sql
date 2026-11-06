begin;

alter table notes
  add column content_json jsonb,
  add column content_text text;

with lines as (
  select
    s.note_id,
    s.note_order,
    s.id as section_id,
    l.ord,
    l.line
  from note_section s
  cross join lateral regexp_split_to_table(coalesce(s.content, ''), E'\r?\n')
       with ordinality as l(line, ord)
),
docs as (
  select
    note_id,
    jsonb_agg(
      case
        when line = '' then jsonb_build_object('type', 'paragraph')
        else jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', line)
          )
        )
      end
      order by note_order, section_id, ord
    ) as content,
    string_agg(line, E'\n' order by note_order, section_id, ord) as plain
  from lines
  group by note_id
)
update notes n
set content_json = jsonb_build_object('type', 'doc', 'content', d.content),
    content_text = d.plain
from docs d
where d.note_id = n.id;

-- notes that had no sections at all
update notes
set content_json = '{"type":"doc","content":[{"type":"paragraph"}]}',
    content_text = ''
where content_json is null;

alter table notes
  alter column content_json set not null,
  alter column content_text set default '';

commit;