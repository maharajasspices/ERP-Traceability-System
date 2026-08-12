import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [recoverySession, setRecoverySession] = useState(false);

  useEffect(() => {
    const setupRecovery = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setRecoverySession(true);
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    setupRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoverySession(true);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setUpdating(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("Password reset error:", error);
      toast.error(error.message);
      setUpdating(false);
      return;
    }

    toast.success("Password updated successfully!");

    await supabase.auth.signOut();

    navigate("/auth");

    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f6]">
        <Loader2 className="h-8 w-8 animate-spin text-[#b30000]" />
      </div>
    );
  }

  if (!recoverySession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f6] p-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">

          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <Lock className="h-7 w-7 text-[#b30000]" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Reset Link Invalid
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            This password reset link is invalid or has expired.
            Please request a new password reset email.
          </p>

          <button
            onClick={() => navigate("/auth")}
            className="mt-6 w-full rounded-xl bg-[#b30000] px-5 py-3 font-semibold text-white hover:bg-[#8f0000]"
          >
            Return to Login
          </button>

        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f6] p-4">

      <div className="w-full max-w-md">

        <div className="mb-6 text-center">

          <h1 className="text-3xl font-bold text-gray-900">
            Reset Password
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Create a new password for your Maharaja's Spices account.
          </p>

        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">

          <form onSubmit={handleResetPassword} className="space-y-5">

            {/* New Password */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                New Password
              </label>

              <div className="relative">

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 outline-none focus:border-[#b30000] focus:ring-2 focus:ring-red-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>

              </div>

              <p className="mt-1 text-xs text-gray-400">
                Minimum 6 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>

              <div className="relative">

                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 outline-none focus:border-[#b30000] focus:ring-2 focus:ring-red-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>

              </div>
            </div>

            <button
              type="submit"
              disabled={updating}
              className="flex w-full items-center justify-center rounded-xl bg-[#b30000] px-5 py-3.5 font-semibold text-white transition hover:bg-[#8f0000] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Update Password"
              )}
            </button>

          </form>

        </div>

      </div>

    </div>
  );
};

export default ResetPassword;