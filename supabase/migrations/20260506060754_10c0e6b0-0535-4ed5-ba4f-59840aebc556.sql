-- Reset all staff accounts so the very next sign-up becomes the new Admin
DELETE FROM public.user_roles;
DELETE FROM public.profiles;
DELETE FROM auth.users;