import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { usePasswordBreachCheck } from '@/hooks/usePasswordBreachCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, ShieldAlert, AlertTriangle, ArrowLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

// Only these 3 email addresses are authorized for the HR Department
const HR_AUTHORIZED_EMAILS = new Set([
  'zulaigah.benjamin@maharajasspices.co.za',
  'bradly@maharajasspices.co.za',
  'selena.veerannah@maharajasspices.co.za',
]);

const HRLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, fmsUser, loading: authLoading, signIn } = useFMSAuth();
  const { checkPassword, isChecking } = usePasswordBreachCheck();

  const [isLoading, setIsLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  const [accessDenied, setAccessDenied] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [passwordBreached, setPasswordBreached] = useState<{ isBreached: boolean; count: number } | null>(null);

  useEffect(() => {
    if (!authLoading && user && fmsUser) {
      // Only send HR users to the HR dashboard; everyone else goes to the traceability dashboard
      if (fmsUser.role === 'hr_user' || fmsUser.role === 'system_admin') {
        navigate('/hr-dashboard', { replace: true });
      } else {
        navigate('/hr-login', { replace: true });
      }
    }
    if (!authLoading && user && !fmsUser) {
      setAccessDenied(true);
    }
  }, [user, fmsUser, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) return;

    // Restrict login to the 3 authorized HR email addresses
    const normalizedEmail = loginForm.email.trim().toLowerCase();
    if (!HR_AUTHORIZED_EMAILS.has(normalizedEmail)) {
      setNotAuthorized(true);
      setAccessDenied(false);
      return;
    }
    setNotAuthorized(false);

    setIsLoading(true);
    setAccessDenied(false);
    setPasswordBreached(null);

    const breachResult = await checkPassword(loginForm.password);
    if (breachResult.isBreached) {
      setPasswordBreached(breachResult);
      toast.warning(
        `This password has been found in ${breachResult.count.toLocaleString()} data breaches. Consider changing it after login.`
      );
    }

    await signIn(normalizedEmail, loginForm.password);
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-950 via-emerald-900 to-background p-4">
      {/* Back to Portal */}
      <button
        onClick={() => navigate('/')}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-emerald-200/70 transition-colors hover:text-emerald-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Systems Portal
      </button>

      <div className="mb-8 flex flex-col items-center gap-3">
        <img src={logo} alt="Maharaja's Spices" className="h-16 w-auto max-w-[160px] object-contain" />
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">HR Department</h1>
        </div>
        <p className="text-sm text-emerald-200/70">Human Resources & Staff Management</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>HR Staff Login</CardTitle>
          <CardDescription>
            Sign in with your authorized account to access the HR system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notAuthorized && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <Lock className="h-5 w-5 flex-shrink-0" />
              <p>Access restricted. Only authorized HR staff can sign in.</p>
            </div>
          )}

          {!notAuthorized && passwordBreached?.isBreached && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p>
                Warning: This password was found in {passwordBreached.count.toLocaleString()} data breaches. Please change it soon.
              </p>
            </div>
          )}

          {!notAuthorized && accessDenied && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert className="h-5 w-5 flex-shrink-0" />
              <p>Access denied. Your account is not authorized for the HR system.</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hr-email">Email</Label>
              <Input
                id="hr-email"
                type="email"
                placeholder="your@maharajasspices.co.za"
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="hr-password">Password</Label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <Input
                id="hr-password"
                type="password"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={isLoading || isChecking}
            >
              {isLoading || isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isChecking ? "Checking security..." : "Signing in..."}
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Sign In to HR
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-emerald-200/50">
        HR Department System<br />© {new Date().getFullYear()} Maharaja's Spices
      </p>
    </div>
  );
};

export default HRLogin;