-- SUPABASE SCHEMA FOR FISHSPEECH 1.5 (v15)
-- AUTH: Profiles, Credits, and Atomic Deduction RPC

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE,
    credit_balance INTEGER DEFAULT 5000 CHECK (credit_balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Cloned Voices Table
CREATE TABLE IF NOT EXISTS public.cloned_voices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    r2_uuid_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Atomic Debit Function (RPC)
-- This ensures credits are subtracted ONLY if enough balance exists
CREATE OR REPLACE FUNCTION validate_and_subtract_credits(
    p_user_id UUID,
    p_char_count INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    SELECT credit_balance INTO current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE; -- Row-level lock

    IF current_balance >= p_char_count THEN
        UPDATE public.profiles
        SET credit_balance = credit_balance - p_char_count
        WHERE id = p_user_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
