import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { LoginForm } from "./LoginForm";
import { useAuth } from "./useAuth";

interface LoginLocationState {
  registered?: boolean;
  username?: string;
}

function getSafeRedirect(raw: string | null): string {
  if (!raw) return "/me/submissions";
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/me/submissions";
}

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const routeState = (location.state as LoginLocationState | null) ?? null;
  const rawRedirect = searchParams.get("redirect");
  const redirectTarget = getSafeRedirect(rawRedirect);
  const justLoggedInRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !justLoggedInRef.current) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const registerLink = rawRedirect
    ? `/register?redirect=${encodeURIComponent(rawRedirect)}`
    : "/register";

  return (
    <AuthCard title="登录你的账号">
      <LoginForm
        initialUsername={routeState?.username ?? ""}
        registeredBanner={Boolean(routeState?.registered)}
        onSuccess={() => {
          justLoggedInRef.current = true;
          navigate(redirectTarget, { replace: true });
        }}
        onSwitchToRegister={() => navigate(registerLink)}
      />
    </AuthCard>
  );
}
