import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from "@/lib/types";
import { MockAuthError } from "./mock-auth-api";
import { PasswordInput } from "./PasswordInput";
import { useAuth } from "./useAuth";

interface LoginFormProps {
  initialUsername?: string;
  registeredBanner?: boolean;
  onSuccess: (user: User) => void;
  onSwitchToRegister: () => void;
}

export function LoginForm({
  initialUsername = "",
  registeredBanner = false,
  onSuccess,
  onSwitchToRegister,
}: LoginFormProps) {
  const { login } = useAuth();

  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = !submitting && username.length > 0 && password.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setFormError(null);

    try {
      // 严格按原样大小写提交用户名，密码不做 trim()
      const user = await login(username, password);
      toast.success(`欢迎回来，${user.username}`);
      onSuccess(user);
    } catch (err) {
      if (err instanceof MockAuthError) {
        if (err.status === 429) {
          setFormError(
            err.retryAfter
              ? `请求过于频繁，请 ${err.retryAfter} 秒后再试`
              : "请求过于频繁，请稍后再试",
          );
        } else {
          // 统一错误文案，不区分账号是否存在
          setFormError("用户名或密码错误");
        }
      } else {
        setFormError("登录失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {registeredBanner && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/70 px-3 py-2.5 text-xs text-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          <span>注册成功，请使用新账号登录</span>
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-username" className="text-sm font-medium">
            用户名
          </label>
          <Input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
            placeholder="输入用户名"
            autoComplete="username"
            autoFocus={!initialUsername}
          />
          <p className="text-xs text-muted-foreground">用户名区分大小写</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="login-password" className="text-sm font-medium">
            密码
          </label>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            placeholder="输入密码"
            autoComplete="current-password"
            autoFocus={Boolean(initialUsername)}
          />
        </div>

        <Button type="submit" disabled={!canSubmit} className="w-full">
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span>登录中...</span>
            </>
          ) : (
            <span>登录</span>
          )}
        </Button>

        <p className="pt-1 text-center text-[11px] text-muted-foreground">
          预置测试账号：<code className="font-mono">Alice</code> /{" "}
          <code className="font-mono">password123</code>
        </p>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        还没有账号？{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-medium text-foreground underline underline-offset-4 hover:opacity-80 cursor-pointer"
        >
          去注册
        </button>
      </p>
    </div>
  );
}
