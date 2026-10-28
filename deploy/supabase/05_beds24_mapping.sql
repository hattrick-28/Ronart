-- =====================================================================
-- Link every unit to its room in the NEW Beds24 account.
-- New room IDs: Beds24 → Settings → Properties → Rooms (the "Room Id"
-- column), or run scripts/connect-beds24.mjs which prints them.
-- Replace each <ID> and run. Values below in comments are the OLD account.
-- =====================================================================

update public.units u set beds24_room_id = m.room_id
from (values
  ('AP01', <ID>::bigint),  -- old 748082
  ('AP02', <ID>),          -- old 748083
  ('AP03', <ID>),          -- old 748084
  ('AP04', <ID>),          -- old 748092
  ('AP05', <ID>),          -- old 748093
  ('AP06', <ID>),          -- old 748094
  ('AP07', <ID>),          -- old 748095
  ('AP08', <ID>),          -- old 748096
  ('AP09', <ID>),          -- old 748097
  ('AP10', <ID>),          -- old 748098
  ('AP11', <ID>),          -- old 748099
  ('AP12', <ID>),          -- old 748100
  ('AP13', <ID>),          -- old 748101
  ('SU1',  <ID>),          -- old 748102
  ('SU2',  <ID>),          -- old 748103
  ('SU3',  <ID>),          -- old 748104
  ('SU4',  <ID>),          -- old 748105
  ('SU5',  <ID>)           -- old 748106
) as m(code, room_id)
where u.code = m.code;

-- Check: all 18 must have an id
select code, name, beds24_room_id from public.units order by sort;
