begin;

insert into public.services (
  service_code, category, name, description, icon, image_url, tiers,
  base_price, market_min, market_max, is_flat_visit, booking_fee
)
values
  (
    'svc_air_purifier', 'home_appliances', 'Air Purifier Repair',
    'HEPA and carbon replacement, sensor calibration, and fan repair.',
    'wind', 'https://images.unsplash.com/photo-1585687504040-b6d5e1c5f88a?w=600',
    '[{"name":"Diagnostic","price":399,"features":["Full inspection","Sensor check"]},{"name":"Filter + Fix","price":1499,"features":["New HEPA and carbon","3-month warranty"]}]'::jsonb,
    399, 500, 1500, false, 0
  ),
  (
    'svc_dishwasher_repair', 'home_appliances', 'Dishwasher Repair',
    'Drain issues, spray arms, heating element, and control PCB repair.',
    'utensils', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600',
    '[{"name":"Diagnostic","price":599,"features":["Full check","Nozzle unclog"]},{"name":"Standard Repair","price":1799,"features":["Pump or valve fix","6-month warranty"]},{"name":"Heater Replacement","price":3499,"features":["New heating element","12-month warranty"]}]'::jsonb,
    599, 800, 2500, false, 0
  ),
  (
    'svc_mixer_grinder_repair', 'home_appliances', 'Mixer Grinder Repair',
    'Motor, coupler, blade, and switch fixes at your doorstep.',
    'circle-dot', 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=600',
    '[{"name":"Basic Fix","price":299,"features":["Coupler and switch check"]},{"name":"Motor Service","price":999,"features":["Motor rewind or replace","3-month warranty"]}]'::jsonb,
    299, 400, 1000, false, 0
  ),
  (
    'svc_air_cooler_service', 'home_appliances', 'Air Cooler Service',
    'Pump, cooling pad, motor, and bearing service before summer.',
    'snowflake', 'https://images.unsplash.com/photo-1621600411688-4be93c2c1208?w=600',
    '[{"name":"Pre-Summer Clean","price":349,"features":["Tank clean","Pad replacement"]},{"name":"Full Service","price":999,"features":["Motor and pump","Cooling pad","6-month warranty"]}]'::jsonb,
    349, 500, 1200, false, 0
  ),
  (
    'svc_refrigerator_repair', 'home_appliances', 'Refrigerator Repair',
    'Cooling, ice-making, thermostat, and door seal repairs.',
    'refrigerator', 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600',
    '[{"name":"Diagnostic","price":449,"features":["Full inspection"]},{"name":"Standard Fix","price":1499,"features":["Thermostat or coil work","6-month warranty"]}]'::jsonb,
    449, 600, 2500, false, 0
  ),
  (
    'svc_tv_repair', 'home_appliances', 'TV Repair',
    'Display panel diagnosis, backlight, board, and port fixes.',
    'tv', 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600',
    '[{"name":"Diagnostic Visit","price":549,"features":["Panel test","Board inspection"]},{"name":"Board or Port Fix","price":1799,"features":["Motherboard rework","3-month warranty"]},{"name":"Backlight Replacement","price":3999,"features":["LED strips","6-month warranty"]}]'::jsonb,
    549, 800, 4000, false, 0
  ),
  (
    'svc_microwave_repair', 'home_appliances', 'Microwave Repair',
    'Magnetron, turntable, door switch, and control repairs.',
    'microwave', 'https://images.unsplash.com/photo-1585237072428-1e4d0bf74e0f?w=600',
    '[{"name":"Diagnostic","price":399,"features":["Full check","Cleaning"]},{"name":"Standard Repair","price":1299,"features":["Switch or turntable","6-month warranty"]},{"name":"Magnetron Fix","price":2499,"features":["Magnetron replace","6-month warranty"]}]'::jsonb,
    399, 500, 1500, false, 0
  ),
  (
    'svc_geyser_repair', 'home_appliances', 'Geyser Repair',
    'Heating element, thermostat, pressure valve, and de-scaling.',
    'flame', 'https://images.unsplash.com/photo-1585537301037-6c8f6f9dfa76?w=600',
    '[{"name":"De-scaling","price":449,"features":["Tank flush","Anode check"]},{"name":"Element Replacement","price":1499,"features":["New heating element","6-month warranty"]}]'::jsonb,
    449, 600, 2500, false, 0
  ),
  (
    'svc_curtain_rods_blinds', 'handyman', 'Curtain Rods / Blinds',
    'Rods, brackets, curtain track, and window blinds installation.',
    'blinds', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600',
    '[{"name":"Booking Visit","price":199,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    199, 199, 900, true, 100
  ),
  (
    'svc_bathroom_fittings', 'handyman', 'Bathroom Fittings',
    'Bathroom fittings including shower, jet spray, holders, and shelves.',
    'shower-head', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600',
    '[{"name":"Booking Visit","price":149,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    149, 149, 1200, true, 100
  ),
  (
    'svc_ready_to_assemble_furniture', 'handyman', 'Ready-to-Assemble Furniture',
    'Flat-pack assembly for beds, wardrobes, desks, and small furniture.',
    'package', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?w=600',
    '[{"name":"Booking Visit","price":399,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    399, 399, 2000, true, 100
  ),
  (
    'svc_wall_art_mirrors', 'handyman', 'Wall Art / Mirrors',
    'Mount paintings, mirrors, and photo frames with care.',
    'image', 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600',
    '[{"name":"Booking Visit","price":149,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    149, 149, 800, true, 100
  ),
  (
    'svc_fancy_lights_chandeliers', 'handyman', 'Fancy Lights / Chandeliers',
    'Chandelier hanging, pendant lights, and accent light installation.',
    'lightbulb', 'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=600',
    '[{"name":"Booking Visit","price":299,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    299, 299, 2000, true, 100
  ),
  (
    'svc_door_locks_hinges', 'handyman', 'Door Locks / Hinges',
    'Repair or replace door locks, latches, and hinges.',
    'lock', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
    '[{"name":"Booking Visit","price":249,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    249, 249, 900, true, 100
  ),
  (
    'svc_ro_wall_mounting', 'handyman', 'RO Wall Mounting',
    'Wall mount your new RO unit with inlet and outlet piping support.',
    'droplets', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?w=600',
    '[{"name":"Booking Visit","price":249,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    249, 249, 1200, true, 100
  ),
  (
    'svc_faucet_jet_spray', 'handyman', 'Faucet / Jet Spray Replacement',
    'Bathroom and kitchen faucet or jet spray fix and replacement.',
    'wrench', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600',
    '[{"name":"Booking Visit","price":149,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    149, 149, 900, true, 100
  ),
  (
    'svc_bike_roadside_fix', 'car_and_bike', 'Bike Roadside Fix',
    'Fix breakdowns, electrical issues, and engine problems on-site.',
    'wrench', 'https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=600',
    '[{"name":"Quick Fix","price":399,"features":["Roadside visit"]},{"name":"Engine Diagnostics","price":1899,"features":["Engine check","Parts extra"]}]'::jsonb,
    399, 500, 1500, false, 0
  ),
  (
    'svc_car_battery_jumpstart', 'car_and_bike', 'Car Battery Jumpstart',
    'Battery jumpstart and replacement at your location.',
    'battery-charging', 'https://images.unsplash.com/photo-1620994533072-33e6d29fefb1?w=600',
    '[{"name":"Jumpstart","price":499,"features":["On-spot jumpstart"]},{"name":"Replacement","price":5999,"features":["New battery","Old battery pickup"]}]'::jsonb,
    499, 550, 1500, false, 0
  )
on conflict (service_code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  image_url = excluded.image_url,
  tiers = excluded.tiers,
  base_price = excluded.base_price,
  market_min = excluded.market_min,
  market_max = excluded.market_max,
  is_flat_visit = excluded.is_flat_visit,
  booking_fee = excluded.booking_fee,
  active = true;

commit;
