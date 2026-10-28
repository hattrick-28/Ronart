-- =====================================================================
-- Ronart Apartments: starting data (18 units + booking rules)
-- Run AFTER 01_schema.sql.
-- =====================================================================

insert into public.settings (key, value) values
('check_in_time', '"16:00"'::jsonb),
('check_out_time', '"10:00"'::jsonb),
('free_cancellation_days', '3'::jsonb),
('full_payment_discount_pct', '5'::jsonb),
('guest_data_retention_years', '6'::jsonb),
('hold_minutes', '15'::jsonb),
('id_doc_retention_days', '30'::jsonb),
('max_active_bookings_per_contact', '3'::jsonb),
('phone_confirm_hours', '24'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into public.units (code, name, type, description_sq, description_en, max_guests, beds, size_m2, has_balcony, base_price, sort) values
('AP01', 'Apartamenti 1', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 1),
('AP02', 'Apartamenti 2', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 2),
('AP03', 'Apartamenti 3', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, true, 45.00, 3),
('AP04', 'Apartamenti 4', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 4),
('AP05', 'Apartamenti 5', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 5),
('AP06', 'Apartamenti 6', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, true, 45.00, 6),
('AP07', 'Apartamenti 7', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 7),
('AP08', 'Apartamenti 8', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 8),
('AP09', 'Apartamenti 9', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, true, 45.00, 9),
('AP10', 'Apartamenti 10', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 10),
('AP11', 'Apartamenti 11', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 11),
('AP12', 'Apartamenti 12', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, true, 45.00, 12),
('AP13', 'Apartamenti 13', 'apartment', 'Apartament i ngrohtë me mur të gjelbër të teksturuar, dru arre dhe dritë të butë.', 'A warm apartment with a textured green feature wall, walnut wood and soft light.', 2, '1 krevat dopio', 28, false, 45.00, 13),
('SU1', 'Suita 1', 'suite', 'Suitë e gjerë me dritare nga dyshemeja deri në tavan, ballkon dhe zonë ndenjeje.', 'A spacious suite with floor-to-ceiling windows, balcony and a sitting area.', 3, '1 krevat king + divan', 38, true, 60.00, 101),
('SU2', 'Suita 2', 'suite', 'Suitë e gjerë me dritare nga dyshemeja deri në tavan, ballkon dhe zonë ndenjeje.', 'A spacious suite with floor-to-ceiling windows, balcony and a sitting area.', 3, '1 krevat king + divan', 38, true, 60.00, 102),
('SU3', 'Suita 3', 'suite', 'Suitë e gjerë me dritare nga dyshemeja deri në tavan, ballkon dhe zonë ndenjeje.', 'A spacious suite with floor-to-ceiling windows, balcony and a sitting area.', 3, '1 krevat king + divan', 38, true, 60.00, 103),
('SU4', 'Suita 4', 'suite', 'Suitë e gjerë me dritare nga dyshemeja deri në tavan, ballkon dhe zonë ndenjeje.', 'A spacious suite with floor-to-ceiling windows, balcony and a sitting area.', 3, '1 krevat king + divan', 38, true, 60.00, 104),
('SU5', 'Suita 5', 'suite', 'Suitë e gjerë me dritare nga dyshemeja deri në tavan, ballkon dhe zonë ndenjeje.', 'A spacious suite with floor-to-ceiling windows, balcony and a sitting area.', 3, '1 krevat king + divan', 38, true, 60.00, 105)
on conflict (code) do nothing;
