-- MIGRATION: UPDATE ALL USERS TO 5000 CREDITS (v15.1)
UPDATE public.profiles 
SET credit_balance = 5000 
WHERE credit_balance = 100;
