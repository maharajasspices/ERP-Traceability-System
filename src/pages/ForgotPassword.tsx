import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft } from "lucide-react";

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  

  const handleResetRequest = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    
    setLoading(false);

    if (error) {
      console.error("Password reset error:", error);
      toast.error(error.message);
      return;
    }

    setSent(true);
    toast.success("Password reset email sent.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">

      <div className="w-full max-w-md">

        <div className="rounded-2xl border bg-card p-8 shadow-sm">

          <div className="mb-6 text-center">

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>

            <h1 className="text-2xl font-bold">
              Forgot Password?
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </p>

          </div>

          {sent ? (
            <div className="space-y-4 text-center">

              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm">
                Check your email for the password reset link.
              </div>

              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:opacity-90"
              >
                Return to Login
              </button>

            </div>
          ) : (
            <form
              onSubmit={handleResetRequest}
              className="space-y-5"
            >

              <div className="space-y-2">

                <label
                  htmlFor="email"
                  className="text-sm font-medium"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                />

              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >

                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Email"
                )}

              </button>

              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </button>

            </form>
          )}

        </div>

      </div>

    </div>
  );
};

export default ForgotPassword;