-- Database triggers for Supabase Auth integration
-- Run these in Supabase SQL Editor or via migration

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to handle new user creation from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    supabase_id,
    email,
    email_verified,
    first_name,
    last_name,
    display_name,
    avatar_url,
    provider,
    status,
    role,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    NEW.email_confirmed_at IS NOT NULL,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 
             CASE 
               WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL 
               THEN substring(NEW.raw_user_meta_data->>'full_name' from position(' ' in NEW.raw_user_meta_data->>'full_name') + 1)
               ELSE NULL 
             END),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    'PENDING_ONBOARDING',
    'JOB_SEEKER',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table (Supabase internal)
-- Note: This needs to be created in the auth schema, which requires superuser access
-- In Supabase, you can use the dashboard or contact support for this

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to handle user updates from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    email = NEW.email,
    email_verified = NEW.email_confirmed_at IS NOT NULL,
    first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name),
    last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name),
    display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', display_name),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', avatar_url),
    updated_at = NOW()
  WHERE supabase_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Create update trigger
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Function to handle user deletion (soft delete)
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    status = 'INACTIVE',
    updated_at = NOW()
  WHERE supabase_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Create deletion trigger
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
REVOKE ALL ON public.users FROM authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (first_name, last_name, display_name, avatar_url, updated_at) ON public.users TO authenticated;
GRANT ALL ON public.job_seeker_profiles TO authenticated;
GRANT ALL ON public.employer_profiles TO authenticated;
GRANT ALL ON public.freelancer_profiles TO authenticated;
GRANT ALL ON public.experiences TO authenticated;
GRANT ALL ON public.educations TO authenticated;
GRANT ALL ON public.certifications TO authenticated;
GRANT ALL ON public.portfolio_items TO authenticated;

-- Enable RLS (Row Level Security) on tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_seeker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  USING (supabase_id = auth.uid());

CREATE POLICY "Users can update their own data"
  ON public.users FOR UPDATE
  USING (supabase_id = auth.uid())
  WITH CHECK (supabase_id = auth.uid());

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE supabase_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- RLS Policies for job_seeker_profiles
CREATE POLICY "Users can manage their own job seeker profile"
  ON public.job_seeker_profiles FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- RLS Policies for employer_profiles
CREATE POLICY "Users can manage their own employer profile"
  ON public.employer_profiles FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- RLS Policies for freelancer_profiles
CREATE POLICY "Users can manage their own freelancer profile"
  ON public.freelancer_profiles FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- RLS Policies for related tables
CREATE POLICY "Users can manage their own experiences"
  ON public.experiences FOR ALL
  USING (profile_id IN (SELECT id FROM public.job_seeker_profiles WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())));

CREATE POLICY "Users can manage their own educations"
  ON public.educations FOR ALL
  USING (profile_id IN (SELECT id FROM public.job_seeker_profiles WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())));

CREATE POLICY "Users can manage their own certifications"
  ON public.certifications FOR ALL
  USING (profile_id IN (SELECT id FROM public.job_seeker_profiles WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())));

CREATE POLICY "Users can manage their own portfolio items"
  ON public.portfolio_items FOR ALL
  USING (profile_id IN (SELECT id FROM public.job_seeker_profiles WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())));
