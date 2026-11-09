
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { usePasswordBreachCheck } from '@/hooks/usePasswordBreachCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Loader2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

const MarketingLogin: React.FC = () => {
  const navigate = useNavigate();

  const {
    user,
    fmsUser,
    loading: authLoading,
    signIn,
  } = useFMSAuth();

  const { checkPassword, isChecking } = usePasswordBreachCheck();

  const [isLoading, setIsLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const [accessDenied, setAccessDenied] = useState(false);

  const [passwordBreached, setPasswordBreached] = useState<{
    isBreached: boolean;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    if (!fmsUser) {
      setAccessDenied(true);
      return;
    }

    if (
      fmsUser.role === 'marketing_user' ||
      fmsUser.role === 'system_admin'
    ) {
      navigate('/marketing-system/dashboard', { replace: true });
    } else {
      setAccessDenied(true);
    }
  }, [user, fmsUser, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginForm.email || !loginForm.password) return;

    setIsLoading(true);
    setAccessDenied(false);
    setPasswordBreached(null);

    try {
      const breachResult = await checkPassword(loginForm.password);

      if (breachResult.isBreached) {
        setPasswordBreached(breachResult);

        toast.warning(
          `This password has been found in ${breachResult.count.toLocaleString()} data breaches. Consider changing it after login.`
        );
      }

      await signIn(loginForm.email, loginForm.password);
    } catch (error) {
      console.error('Marketing login error:', error);
      toast.error('Unable to sign in. Please check your login details.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">

      {/* Branding */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <img
          src={logo}
          alt="Maharaja's Spices"
          className="h-16 w-auto max-w-[160px] object-contain"
        />

        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />

          <h1 className="text-xl font-bold text-foreground">
            Marketing System
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Marketing & Brand Management
        </p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Staff Login</CardTitle>

         <CardDescription>
          Sign in with your authorized ERP account to access the Marketing System.
        </CardDescription>
        </CardHeader>

        <CardContent>

          {/* Password Warning */}
          {passwordBreached?.isBreached && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />

              <p>
                Warning: This password was found in{' '}
                {passwordBreached.count.toLocaleString()} data breaches.
                Please change it soon.
              </p>
            </div>
          )}

          {/* Access Denied */}
          {accessDenied && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert className="h-5 w-5 flex-shrink-0" />

              <p>
                Access denied. Your account is not authorized for the
                Marketing System. Please contact your administrator.
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="quality-email">Email</Label>

              <Input
                id="marketing-email"
                type="email"
                placeholder="your@email.com"
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

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="marketing-password">
                  Password
                </Label>

                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <Input
                id="marketing-password"
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

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isChecking}
            >
              {isLoading || isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isChecking ? 'Checking security...' : 'Signing in...'}
                </>
              ) : (
                'Sign In'
              )}
            </Button>

          </form>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Maharaja's Spices Marketing System
        <br />
        © {new Date().getFullYear()} Maharaja's Spices
      </p>
    </div>
  );
};

export default MarketingLogin;