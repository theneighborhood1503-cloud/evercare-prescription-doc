CREATE TYPE public.app_role AS ENUM ('patient','caregiver');
CREATE TYPE public.dose_status AS ENUM ('taken','skipped','missed','snoozed');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  timezone text NOT NULL DEFAULT 'UTC',
  snooze_minutes int NOT NULL DEFAULT 10 CHECK (snooze_minutes BETWEEN 1 AND 120),
  quiet_start time,
  quiet_end time,
  browser_notifications boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.caregiver_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  caregiver_email text NOT NULL,
  caregiver_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  can_view boolean NOT NULL DEFAULT true,
  alert_on_missed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, caregiver_email)
);
CREATE INDEX ON public.caregiver_links (caregiver_id);
CREATE INDEX ON public.caregiver_links (lower(caregiver_email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_links TO authenticated;
GRANT ALL ON public.caregiver_links TO service_role;
ALTER TABLE public.caregiver_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_caregiver_of(_patient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.caregiver_links
    WHERE patient_id = _patient AND caregiver_id = auth.uid() AND status = 'accepted' AND can_view)
$$;

CREATE POLICY "patient manages links" ON public.caregiver_links FOR ALL TO authenticated
  USING (patient_id = auth.uid()) WITH CHECK (patient_id = auth.uid());
CREATE POLICY "invitee reads links" ON public.caregiver_links FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid() OR lower(caregiver_email) = lower(coalesce(auth.jwt()->>'email','')));

CREATE OR REPLACE FUNCTION public.respond_caregiver_invite(_link uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.caregiver_links
    SET caregiver_id = CASE WHEN _accept THEN auth.uid() ELSE caregiver_id END,
        status = CASE WHEN _accept THEN 'accepted' ELSE 'revoked' END
  WHERE id = _link AND status = 'pending'
    AND lower(caregiver_email) = lower(coalesce(auth.jwt()->>'email',''));
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF _accept THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'caregiver') ON CONFLICT DO NOTHING;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.respond_caregiver_invite(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.respond_caregiver_invite(uuid, boolean) TO authenticated;

CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_caregiver_of(id));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  brand text,
  dosage text NOT NULL,
  dosage_form text,
  instructions text,
  food_instruction text CHECK (food_instruction IN ('before_food','after_food','with_food','none')),
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekdays','as_needed')),
  days_of_week int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  times text[] NOT NULL DEFAULT '{}',
  doses_per_time numeric NOT NULL DEFAULT 1 CHECK (doses_per_time > 0),
  quantity_remaining numeric CHECK (quantity_remaining >= 0),
  refill_threshold numeric CHECK (refill_threshold >= 0),
  prescriber_notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.medications (user_id, archived);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meds" ON public.medications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "caregiver reads meds" ON public.medications FOR SELECT TO authenticated USING (public.is_caregiver_of(user_id));

CREATE TABLE public.dose_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status public.dose_status NOT NULL,
  acted_at timestamptz NOT NULL DEFAULT now(),
  snooze_until timestamptz,
  note text,
  UNIQUE (medication_id, scheduled_at)
);
CREATE INDEX ON public.dose_events (user_id, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_events TO authenticated;
GRANT ALL ON public.dose_events TO service_role;
ALTER TABLE public.dose_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own doses" ON public.dose_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "caregiver reads doses" ON public.dose_events FOR SELECT TO authenticated USING (public.is_caregiver_of(user_id));

CREATE TABLE public.refills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  quantity_added numeric NOT NULL CHECK (quantity_added > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.refills TO authenticated;
GRANT ALL ON public.refills TO service_role;
ALTER TABLE public.refills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own refills" ON public.refills FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  substance text NOT NULL CHECK (length(substance) BETWEEN 1 AND 200),
  reaction text,
  severity text CHECK (severity IN ('mild','moderate','severe','unknown')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allergies TO authenticated;
GRANT ALL ON public.allergies TO service_role;
ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own allergies" ON public.allergies FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "caregiver reads allergies" ON public.allergies FOR SELECT TO authenticated USING (public.is_caregiver_of(user_id));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'patient') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();