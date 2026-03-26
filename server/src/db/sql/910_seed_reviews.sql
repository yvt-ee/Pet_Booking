-- server/src/db/sql/910_seed_reviews.sql

-- =========================================
-- 0 清空旧数据（开发环境）
-- =========================================

TRUNCATE TABLE reviews, requests, pets, clients RESTART IDENTITY CASCADE;



-- =========================================
-- 1 services
-- =========================================

INSERT INTO services (service_type, base_rate_per_day)
VALUES
('Boarding',80),
('House Sitting',95);



-- =========================================
-- 2 clients
-- =========================================

INSERT INTO clients (id,name,email,phone,notes) VALUES

('11111111-1111-1111-1111-111111111111','Tarryn M.','tarryn.demo@example.com','2065551001','seed'),

('22222222-2222-2222-2222-222222222222','Layne B.','layne.demo@example.com','2065551002','seed'),

('33333333-3333-3333-3333-333333333333','Sarah J.','sarah.demo@example.com','2065551003','seed'),

('44444444-4444-4444-4444-444444444444','Allison C.','allison.demo@example.com','2065551004','seed'),

('55555555-5555-5555-5555-555555555555','Alexander K.','alexander.demo@example.com','2065551005','seed'),

('66666666-6666-6666-6666-666666666666','Leon O.','leon.demo@example.com','2065551006','seed');



-- =========================================
-- 3 pets
-- =========================================

INSERT INTO pets (
id,
client_id,
name,
pet_type,
breed,
age_years,
weight_lbs,
energy_level,
microchipped,
spayed_neutered,
veterinary_info,
pet_insurance,
notes
)

VALUES

(
'aaaa1111-1111-1111-1111-111111111111',
'11111111-1111-1111-1111-111111111111',
'Bruce','DOG','Mixed Breed',5,42,'Moderate',
true,true,'Seattle Vet Clinic','Healthy Paws','Friendly dog'
),

(
'aaaa2222-2222-2222-2222-222222222222',
'22222222-2222-2222-2222-222222222222',
'Lulu','DOG','Shiba Inu',4,22,'Moderate',
true,true,'Ballard Animal Hospital','Trupanion','Repeat guest'
),

(
'aaaa3333-3333-3333-3333-333333333333',
'33333333-3333-3333-3333-333333333333',
'Furry Child','DOG','Terrier Mix',6,18,'Moderate',
true,true,'Queen Anne Vet','Trupanion','Boarding guest'
),

(
'aaaa4444-4444-4444-4444-444444444444',
'44444444-4444-4444-4444-444444444444',
'Kitty','CAT','Tabby',3,10,'Low',
true,true,'Cat Clinic Seattle','Nationwide','Happy kitty'
),

(
'aaaa5555-5555-5555-5555-555555555555',
'55555555-5555-5555-5555-555555555555',
'Lucy','DOG','Black Lab Mix',7,48,'Moderate',
true,true,'Seattle Vet Center','Healthy Paws','Boarding dog'
),

(
'aaaa6666-6666-6666-6666-666666666666',
'66666666-6666-6666-6666-666666666666',
'Cat','CAT','Longhair Mix',5,11,'Low',
true,true,'North Seattle Vet','None','Boarding cat'
);



-- =========================================
-- 4 requests
-- =========================================

INSERT INTO requests (
id,
client_id,
service_id,
start_at,
end_at,
notes,
status
)

VALUES

(
'bbbb1111-1111-1111-1111-111111111111',
'11111111-1111-1111-1111-111111111111',
(SELECT id FROM services WHERE service_type='House Sitting'),
'2025-11-20T10:00:00-08:00',
'2025-11-30T10:00:00-08:00',
'seed request',
'COMPLETED'
),

(
'bbbb2222-2222-2222-2222-222222222222',
'22222222-2222-2222-2222-222222222222',
(SELECT id FROM services WHERE service_type='Boarding'),
'2025-11-15T10:00:00-08:00',
'2025-11-18T10:00:00-08:00',
'seed request',
'COMPLETED'
),

(
'bbbb3333-3333-3333-3333-333333333333',
'22222222-2222-2222-2222-222222222222',
(SELECT id FROM services WHERE service_type='Boarding'),
'2025-12-10T10:00:00-08:00',
'2025-12-14T10:00:00-08:00',
'seed request',
'COMPLETED'
),

(
'bbbb4444-4444-4444-4444-444444444444',
'33333333-3333-3333-3333-333333333333',
(SELECT id FROM services WHERE service_type='Boarding'),
'2025-12-04T10:00:00-08:00',
'2025-12-07T10:00:00-08:00',
'seed request',
'COMPLETED'
),

(
'bbbb5555-5555-5555-5555-555555555555',
'44444444-4444-4444-4444-444444444444',
(SELECT id FROM services WHERE service_type='Boarding'),
'2026-01-08T10:00:00-08:00',
'2026-01-11T10:00:00-08:00',
'seed request',
'COMPLETED'
),

(
'bbbb6666-6666-6666-6666-666666666666',
'55555555-5555-5555-5555-555555555555',
(SELECT id FROM services WHERE service_type='Boarding'),
'2026-01-02T10:00:00-08:00',
'2026-01-05T10:00:00-08:00',
'seed request',
'COMPLETED'
),

(
'bbbb7777-7777-7777-7777-777777777777',
'66666666-6666-6666-6666-666666666666',
(SELECT id FROM services WHERE service_type='Boarding'),
'2026-01-02T10:00:00-08:00',
'2026-01-05T10:00:00-08:00',
'seed request',
'COMPLETED'
);

-- =========================================
-- 4.1 request_pets
-- =========================================

INSERT INTO request_pets (request_id, pet_id) VALUES
('bbbb1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111'),
('bbbb2222-2222-2222-2222-222222222222', 'aaaa2222-2222-2222-2222-222222222222'),
('bbbb3333-3333-3333-3333-333333333333', 'aaaa2222-2222-2222-2222-222222222222'),
('bbbb4444-4444-4444-4444-444444444444', 'aaaa3333-3333-3333-3333-333333333333'),
('bbbb5555-5555-5555-5555-555555555555', 'aaaa4444-4444-4444-4444-444444444444'),
('bbbb6666-6666-6666-6666-666666666666', 'aaaa5555-5555-5555-5555-555555555555'),
('bbbb7777-7777-7777-7777-777777777777', 'aaaa6666-6666-6666-6666-666666666666');

-- =========================================
-- 5 reviews
-- =========================================

INSERT INTO reviews (id,request_id,client_id,rating,comment,created_at) VALUES

(
'cccc1111-1111-1111-1111-111111111111',
'bbbb1111-1111-1111-1111-111111111111',
'11111111-1111-1111-1111-111111111111',
5,
'We were really happy with the level of communication during the 10 day stay at our house.',
'2025-11-30T18:00:00-08:00'
),

(
'cccc2222-2222-2222-2222-222222222222',
'bbbb2222-2222-2222-2222-222222222222',
'22222222-2222-2222-2222-222222222222',
5,
'Mengyuan is amazing. Very responsive and sends lots of pictures.',
'2025-11-18T18:00:00-08:00'
),

(
'cccc3333-3333-3333-3333-333333333333',
'bbbb3333-3333-3333-3333-333333333333',
'22222222-2222-2222-2222-222222222222',
5,
'Third time Lulu has stayed with Mengyuan. Always a great stay.',
'2025-12-14T18:00:00-08:00'
),

(
'cccc4444-4444-4444-4444-444444444444',
'bbbb4444-4444-4444-4444-444444444444',
'33333333-3333-3333-3333-333333333333',
5,
'Great communication and lots of photos during boarding.',
'2025-12-07T18:00:00-08:00'
),

(
'cccc5555-5555-5555-5555-555555555555',
'bbbb5555-5555-5555-5555-555555555555',
'44444444-4444-4444-4444-444444444444',
5,
'My kitty was very happy and I got frequent updates.',
'2026-01-11T18:00:00-08:00'
),

(
'cccc6666-6666-6666-6666-666666666666',
'bbbb6666-6666-6666-6666-666666666666',
'55555555-5555-5555-5555-555555555555',
5,
'Mengyuan was a great sitter for Lucy!',
'2026-01-05T18:00:00-08:00'
),

(
'cccc7777-7777-7777-7777-777777777777',
'bbbb7777-7777-7777-7777-777777777777',
'66666666-6666-6666-6666-666666666666',
5,
'Took great care of my cat!',
'2026-01-05T18:00:00-08:00'
);