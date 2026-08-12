import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mapAuthError } from '@/lib/errorHandler';

type FMSRole = 'system_admin' | 'production_supervisor' | 'production_operator' | 'stores_operator' | 'dispatch_user' | 'qa_viewer';

interface FMSUser {
  id: string;
  user_id: string;
  name: string;
  role: FMSRole;
  is_active: boolean;
}


interface FMSAuthContextType {
  user: User | null;
  session: Session | null;
  fmsUser: FMSUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: FMSRole) => boolean;
  isAdmin: boolean;
}

const FMSAuthContext = createContext<FMSAuthContextType | undefined>(undefined);

export const FMSAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [fmsUser, setFmsUser] = useState<FMSUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer FMS user fetch to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchFMSUser(session.user.id);
          }, 0);
        } else {
          setFmsUser(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFMSUser(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchFMSUser = async (userId: string, attempt: number = 0) => {
    try {
      const { data, error } = await supabase
        .from('fms_users')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.log('Error fetching FMS user:', error.message);
        setFmsUser(null);
        setLoading(false);
        return;
      }

      if (data) {
        setFmsUser(data as FMSUser);
        setLoading(false);
        return;
      }

      // User authenticated but FMS row might not be created yet (e.g., first-time signup trigger)
      if (attempt < 6) {
        setTimeout(() => {
          fetchFMSUser(userId, attempt + 1);
        }, 600);
        return;
      }

      console.log('No FMS access for this user');
      setFmsUser(null);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching FMS user:', err);
      setFmsUser(null);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        toast.error(mapAuthError(error));
        return { error };
      }

      // Auth state change will trigger fetchFMSUser (with retry)
      return { error: null };
    } catch (err) {
      setLoading(false);
      const error = err as Error;
      toast.error(error.message);
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/auth',
        },
      });

      if (error) {
        setLoading(false);
        toast.error(mapAuthError(error));
        return { error };
      }

      // If email confirmation is enabled, there may be no session yet.
      if (!data.session) {
        setLoading(false);
        toast.success('Account created. Please check your email to confirm, then sign in.');
        return { error: null };
      }

      // Session exists → fetchFMS user record (retry handles trigger delay)
      fetchFMSUser(data.user.id);
      return { error: null };
    } catch (err) {
      setLoading(false);
      const error = err as Error;
      toast.error(error.message);
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setFmsUser(null);
    toast.success('Signed out successfully');
  };

  /**
   * SECURITY NOTE: This function is for UI/UX purposes ONLY (e.g., showing/hiding buttons).
   * All actual authorization is enforced server-side via RLS policies using fms_has_role().
   * NEVER use this for security decisions - the database will always enforce proper access control.
   */
  const hasRole = (role: FMSRole): boolean => {
    return fmsUser?.role === role;
  };

  /**
   * SECURITY NOTE: This is for UI purposes ONLY. Actual admin access is enforced
   * by RLS policies using fms_has_role(auth.uid(), 'system_admin').
   */
  const isAdmin = fmsUser?.role === 'system_admin';

  return (
    <FMSAuthContext.Provider value={{
      user,
      session,
      fmsUser,
      loading,
      signIn,
      signUp,
      signOut,
      hasRole,
      isAdmin,
    }}>
      {children}
    </FMSAuthContext.Provider>
  );
};

export const useFMSAuth = () => {
  const context = useContext(FMSAuthContext);
  if (!context) {
    throw new Error('useFMSAuth must be used within a FMSAuthProvider');
  }
  return context;
};
