import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { RegisterForm } from "./RegisterForm";
import { useAuth } from "./useAuth";

export function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get("redirect");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const loginTarget = rawRedirect
    ? `/login?redirect=${encodeURIComponent(rawRedirect)}`
    : "/login";

  return (
    <AuthCard title="创建 MONO 账号">
      <RegisterForm
        onRegistered={(username) =>
          navigate(loginTarget, {
            replace: true,
            state: { registered: true, username },
          })
        }
        onSwitchToLogin={() => navigate(loginTarget)}
      />
    </AuthCard>
  );
}
