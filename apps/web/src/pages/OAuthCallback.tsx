// OAuth callback handler page
// Handles the redirect from GitHub/GitLab after user authorization
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const errorParam = searchParams.get("error");
      
      // Check for OAuth errors
      if (errorParam) {
        setStatus("error");
        setError(`OAuth error: ${searchParams.get("error_description") || errorParam}`);
        return;
      }

      if (!code) {
        setStatus("error");
        setError("No authorization code received");
        return;
      }

      // Verify state
      const savedState = sessionStorage.getItem("oauth_state");
      if (state && savedState && state !== savedState) {
        setStatus("error");
        setError("Invalid state - possible CSRF attack");
        return;
      }

      // Determine provider from path (we'll check the current pathname)
      const path = window.location.pathname;
      const provider = path.includes("/github/") ? "github" : "gitlab";
      const redirectUri = `${window.location.origin}/git/callback`;

      try {
        // Call the appropriate OAuth function
        const functionName = `${provider}-oauth`;
        const { data, error: funcError } = await supabase.functions.invoke(functionName, {
          body: { code, redirect_uri: redirectUri },
        });

        if (funcError) {
          throw new Error(funcError.message || "Failed to complete OAuth");
        }

        setStatus("success");
        
        // Clear OAuth state
        sessionStorage.removeItem("oauth_state");
        
        // Show success message and redirect
        toast({ 
          title: `${provider === "github" ? "GitHub" : "GitLab"} connected!`,
          description: `Logged in as @${data?.username}`,
        });
        
        // Redirect back to developer page after a short delay
        setTimeout(() => {
          navigate("/developer?tab=git");
        }, 1500);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-[14px] text-muted-foreground">
              Connecting your account...
            </p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[14px] text-foreground">
              Successfully connected! Redirecting...
            </p>
          </>
        )}
        
        {status === "error" && (
          <>
            <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-[14px] text-red-500">
              {error || "Connection failed"}
            </p>
            <button
              onClick={() => navigate("/developer?tab=git")}
              className="text-[13px] text-muted-foreground hover:text-foreground underline"
            >
              Return to Developer page
            </button>
          </>
        )}
      </div>
    </div>
  );
}
