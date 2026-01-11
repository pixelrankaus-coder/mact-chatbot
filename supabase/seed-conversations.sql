-- Seed data for conversations and messages
-- Run this in Supabase SQL Editor to populate test data

-- Clear existing data (optional - uncomment if needed)
-- DELETE FROM messages;
-- DELETE FROM conversations;

-- Insert sample conversations
INSERT INTO conversations (id, visitor_id, visitor_name, visitor_email, visitor_phone, visitor_location, status, metadata, created_at, updated_at)
VALUES
  (
    'a1b2c3d4-1111-4000-8000-000000000001',
    'visitor_001',
    'John Smith',
    'john.smith@email.com',
    '+1 (555) 123-4567',
    'Los Angeles, CA',
    'active',
    '{"notes": "Returning customer. Previous project was a residential exterior. Very detail-oriented.", "tags": ["GFRC", "Quote Request", "Returning Customer"]}',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 minutes'
  ),
  (
    'a1b2c3d4-2222-4000-8000-000000000002',
    'visitor_002',
    'Sarah Johnson',
    'sarah.j@archdesign.com',
    '+1 (555) 234-5678',
    'San Francisco, CA',
    'pending',
    '{"notes": "", "tags": ["New Lead", "Architect", "Samples"]}',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '15 minutes'
  ),
  (
    'a1b2c3d4-3333-4000-8000-000000000003',
    'visitor_003',
    'Mike Wilson',
    'mike.w@builders.com',
    '+1 (555) 345-6789',
    'Phoenix, AZ',
    'active',
    '{"notes": "Commercial contractor. Prefers phone calls for complex orders.", "tags": ["Custom Order", "Contractor", "Priority"]}',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'a1b2c3d4-4444-4000-8000-000000000004',
    'visitor_004',
    'Emily Davis',
    'emily@architect.com',
    '',
    'Denver, CO',
    'resolved',
    '{"notes": "Interested in sustainable building materials. May follow up for a larger project.", "tags": ["Inquiry", "Sustainability", "Resolved"]}',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '2 hours'
  ),
  (
    'a1b2c3d4-5555-4000-8000-000000000005',
    'visitor_005',
    'Robert Chen',
    'r.chen@development.com',
    '+1 (555) 456-7890',
    'Seattle, WA',
    'active',
    '{"notes": "", "tags": ["New Lead", "Developer", "Warranty Question"]}',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '3 hours'
  ),
  (
    'a1b2c3d4-6666-4000-8000-000000000006',
    'visitor_006',
    'Lisa Martinez',
    'lisa.m@homeowner.net',
    '+1 (555) 567-8901',
    'Austin, TX',
    'resolved',
    '{"notes": "Homeowner interested in accent wall. Small project but potential referrals.", "tags": ["Residential", "Small Project", "Resolved"]}',
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '5 hours'
  );

-- Insert messages for John Smith conversation
INSERT INTO messages (conversation_id, sender_type, sender_name, content, created_at)
VALUES
  (
    'a1b2c3d4-1111-4000-8000-000000000001',
    'visitor',
    'John Smith',
    'Hi, I am interested in GFRC panels for my new construction project.',
    NOW() - INTERVAL '2 hours'
  ),
  (
    'a1b2c3d4-1111-4000-8000-000000000001',
    'ai',
    'MACt Assistant',
    'Hello John! Welcome back to MACt. I see you have previously ordered from us - thank you for being a returning customer! I would be happy to help you find the right GFRC panels for your new project. Could you tell me more about the size and scope?',
    NOW() - INTERVAL '2 hours' + INTERVAL '30 seconds'
  ),
  (
    'a1b2c3d4-1111-4000-8000-000000000001',
    'visitor',
    'John Smith',
    'Looking for GFRC panels pricing for about 500 sq ft of exterior cladding. Similar to my last order but for a commercial building this time.',
    NOW() - INTERVAL '1 hour 58 minutes'
  ),
  (
    'a1b2c3d4-1111-4000-8000-000000000001',
    'ai',
    'MACt Assistant',
    E'Great! For 500 sq ft of exterior cladding, I would recommend our Commercial Grade GFRC panels. Based on your requirements, here is a rough estimate:\n\n- Standard panels (500 sq ft): $12,500 - $15,000\n- Installation hardware: $800 - $1,200\n- Shipping to Los Angeles: $450 - $600\n\nWould you like me to prepare a detailed quote, or do you have specific design requirements?',
    NOW() - INTERVAL '1 hour 57 minutes'
  );

-- Insert messages for Sarah Johnson conversation
INSERT INTO messages (conversation_id, sender_type, sender_name, content, created_at)
VALUES
  (
    'a1b2c3d4-2222-4000-8000-000000000002',
    'visitor',
    'Sarah Johnson',
    'Hello! I am an architect working on a new mixed-use development. Do you ship to California?',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'a1b2c3d4-2222-4000-8000-000000000002',
    'ai',
    'MACt Assistant',
    'Hello Sarah! Yes, we ship to all 50 states including California. We work with many architects on commercial projects. What type of GFRC application are you considering for your development?',
    NOW() - INTERVAL '1 hour' + INTERVAL '30 seconds'
  ),
  (
    'a1b2c3d4-2222-4000-8000-000000000002',
    'visitor',
    'Sarah Johnson',
    'We are looking at exterior facade panels for a 6-story building. Can I get samples before placing a large order?',
    NOW() - INTERVAL '55 minutes'
  );

-- Insert messages for Mike Wilson conversation
INSERT INTO messages (conversation_id, sender_type, sender_name, content, created_at)
VALUES
  (
    'a1b2c3d4-3333-4000-8000-000000000003',
    'visitor',
    'Mike Wilson',
    'Hi, I need custom sizes for my project. Is that possible?',
    NOW() - INTERVAL '3 hours'
  ),
  (
    'a1b2c3d4-3333-4000-8000-000000000003',
    'ai',
    'MACt Assistant',
    'Hi Mike! Absolutely, MACt specializes in custom GFRC solutions. Our team can create panels in virtually any size and shape. What dimensions are you looking for?',
    NOW() - INTERVAL '3 hours' + INTERVAL '30 seconds'
  ),
  (
    'a1b2c3d4-3333-4000-8000-000000000003',
    'visitor',
    'Mike Wilson',
    'I need panels that are 4ft x 8ft with custom edge profiles. Also need them in a specific gray color to match existing concrete.',
    NOW() - INTERVAL '2 hours 55 minutes'
  ),
  (
    'a1b2c3d4-3333-4000-8000-000000000003',
    'ai',
    'MACt Assistant',
    E'Perfect! 4ft x 8ft panels with custom edge profiles are definitely doable. For color matching, we offer:\n\n1. Standard gray tones (quickest turnaround)\n2. Custom color matching (we will need a sample of your existing concrete)\n\nWhich option works better for your timeline?',
    NOW() - INTERVAL '2 hours 54 minutes'
  ),
  (
    'a1b2c3d4-3333-4000-8000-000000000003',
    'visitor',
    'Mike Wilson',
    'Custom color matching. How do I send you a sample?',
    NOW() - INTERVAL '2 hours 50 minutes'
  ),
  (
    'a1b2c3d4-3333-4000-8000-000000000003',
    'agent',
    'Admin',
    'Hi Mike! This is Sarah from the MACt team. For color matching, you can ship a small concrete sample (4x4 inch is fine) to our facility. I will email you the shipping address and a prepaid label. We typically match colors within 5 business days of receiving the sample.',
    NOW() - INTERVAL '1 hour'
  );

-- Insert messages for Emily Davis conversation
INSERT INTO messages (conversation_id, sender_type, sender_name, content, created_at)
VALUES
  (
    'a1b2c3d4-4444-4000-8000-000000000004',
    'visitor',
    'Emily Davis',
    'What is the lead time for orders?',
    NOW() - INTERVAL '4 hours'
  ),
  (
    'a1b2c3d4-4444-4000-8000-000000000004',
    'ai',
    'MACt Assistant',
    E'Great question! Our standard lead times are:\n\n- Stock panels: 1-2 weeks\n- Standard custom sizes: 3-4 weeks\n- Complex custom designs: 4-6 weeks\n\nRush orders may be available for an additional fee. What type of project are you planning?',
    NOW() - INTERVAL '4 hours' + INTERVAL '30 seconds'
  ),
  (
    'a1b2c3d4-4444-4000-8000-000000000004',
    'visitor',
    'Emily Davis',
    'Just researching options for now. Are your products environmentally friendly?',
    NOW() - INTERVAL '3 hours 55 minutes'
  ),
  (
    'a1b2c3d4-4444-4000-8000-000000000004',
    'ai',
    'MACt Assistant',
    E'Yes! GFRC is an excellent sustainable choice:\n\n- Uses 75% less cement than traditional concrete\n- Lightweight (reduces transportation emissions)\n- Long lifespan (50+ years with minimal maintenance)\n- Can incorporate recycled materials\n\nWe also have LEED documentation available if needed for green building certifications.',
    NOW() - INTERVAL '3 hours 54 minutes'
  ),
  (
    'a1b2c3d4-4444-4000-8000-000000000004',
    'visitor',
    'Emily Davis',
    'Thank you for the quick response! This is very helpful. I will be in touch when we finalize our material selections.',
    NOW() - INTERVAL '2 hours'
  );

-- Insert messages for Robert Chen conversation
INSERT INTO messages (conversation_id, sender_type, sender_name, content, created_at)
VALUES
  (
    'a1b2c3d4-5555-4000-8000-000000000005',
    'visitor',
    'Robert Chen',
    'Hello, I am a property developer looking at GFRC for a new residential complex. What warranty do you offer?',
    NOW() - INTERVAL '5 hours'
  ),
  (
    'a1b2c3d4-5555-4000-8000-000000000005',
    'ai',
    'MACt Assistant',
    E'Hello Robert! Great to hear from you. Our warranty coverage includes:\n\n- 25-year structural warranty on all panels\n- 10-year finish warranty (color and texture)\n- Lifetime support for installation questions\n\nFor large residential developments, we also offer extended warranty options. Would you like more details about your specific project?',
    NOW() - INTERVAL '5 hours' + INTERVAL '30 seconds'
  );

-- Insert messages for Lisa Martinez conversation
INSERT INTO messages (conversation_id, sender_type, sender_name, content, created_at)
VALUES
  (
    'a1b2c3d4-6666-4000-8000-000000000006',
    'visitor',
    'Lisa Martinez',
    'Hi! I am a homeowner looking to add a GFRC accent wall to my living room. Do you do residential projects?',
    NOW() - INTERVAL '6 hours'
  ),
  (
    'a1b2c3d4-6666-4000-8000-000000000006',
    'ai',
    'MACt Assistant',
    E'Hello Lisa! Yes, we love working on residential projects! GFRC accent walls are a beautiful way to add modern elegance to any space. For interior accent walls, we recommend our lightweight panel series - they are easy to install and come in various textures.\n\nCould you tell me the approximate size of the wall you are looking to cover?',
    NOW() - INTERVAL '6 hours' + INTERVAL '30 seconds'
  ),
  (
    'a1b2c3d4-6666-4000-8000-000000000006',
    'visitor',
    'Lisa Martinez',
    'It is about 12 feet wide and 9 feet tall. What would something like that cost?',
    NOW() - INTERVAL '5 hours 45 minutes'
  ),
  (
    'a1b2c3d4-6666-4000-8000-000000000006',
    'ai',
    'MACt Assistant',
    E'For a 12x9 ft (108 sq ft) interior accent wall, here is a ballpark estimate:\n\n- GFRC panels: $2,700 - $3,500\n- Mounting hardware: $150 - $200\n- Shipping to Austin: $180 - $250\n\nTotal: approximately $3,000 - $4,000\n\nThis can vary based on the texture and finish you choose. Would you like to see our design options?',
    NOW() - INTERVAL '5 hours 44 minutes'
  ),
  (
    'a1b2c3d4-6666-4000-8000-000000000006',
    'visitor',
    'Lisa Martinez',
    'That is within my budget! Yes, please send me the design options. My email is lisa.m@homeowner.net',
    NOW() - INTERVAL '5 hours 40 minutes'
  ),
  (
    'a1b2c3d4-6666-4000-8000-000000000006',
    'ai',
    'MACt Assistant',
    E'I have noted your email. Our design team will send you our residential catalog with finish options within 24 hours. In the meantime, you can also browse our gallery at mact-gfrc.com/gallery.\n\nIs there anything else I can help you with today?',
    NOW() - INTERVAL '5 hours'
  );

-- Verify the data was inserted
SELECT
  c.visitor_name,
  c.status,
  COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id, c.visitor_name, c.status
ORDER BY c.updated_at DESC;
