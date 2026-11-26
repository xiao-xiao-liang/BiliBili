import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MockAuthError,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_BYTES,
  USERNAME_REGEX,
  getUtf8ByteLength,
} from "./mock-auth-api";
import { PasswordInput } from "./PasswordInput";
import { useAuth } from "./useAuth";

interface RegisterFormProps {
  onRegistered: (username: string) => void;
  onSwitchToLogin: () => void;
}

export function RegisterForm({
  onRegistered,
  onSwitchToLogin,
}: RegisterFormProps) {
  const { register } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const validate = (): boolean => {
    let valid = true;
    setUsernameError(null);
    setPasswordError(null);
    setConfirmError(null);
    setFormError(null);

    if (!USERNAME_REGEX.test(username)) {
      setUsernameError("用户名需为 3～32 个 ASCII 字母、数字或下划线");
      valid = false;
    }

    // 密码绝不做 trim()，严格按 UTF-8 字节数校验 8～128 字节
    const passwordBytes = getUtf8ByteLength(password);
    if (
      passwordBytes < PASSWORD_MIN_BYTES ||
      passwordBytes > PASSWORD_MAX_BYTES
    ) {
      setPasswordError(
        `密码需为 ${PASSWORD_MIN_BYTES}～${PASSWORD_MAX_BYTES} 字节（当前 ${passwordBytes} 字节）`,
      );
      valid = false;
    }

    if (confirmPassword !== password) {
      setConfirmError("两次输入的密码不一致");
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      // 原样大小写提交用户名，注册不自动登录
      const created = await register(username, password);
      onRegistered(created.username);
    } catch (err) {
      if (err instanceof MockAuthError && err.code === "USERNAME_TAKEN") {
        setUsernameError(err.message);
      } else if (err instanceof MockAuthError) {
        setFormError(err.message);
      } else {
        setFormError("注册失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
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
          <label htmlFor="reg-username" className="text-sm font-medium">
            用户名
          </label>
          <Input
            id="reg-username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError(null);
            }}
            disabled={submitting}
            placeholder="例如 alice（3～32 位字母/数字/下划线）"
            autoComplete="username"
            autoFocus
            aria-invalid={Boolean(usernameError)}
          />
          {usernameError ? (
            <p className="text-xs text-destructive">{usernameError}</p>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              区分大小写，<code className="font-mono">Alice</code> 与{" "}
              <code className="font-mono">alice</code> 为不同账号
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="text-sm font-medium">
            密码
          </label>
          <PasswordInput
            id="reg-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
            }}
            disabled={submitting}
            placeholder="8～128 字节，不自动去除首尾空格"
            autoComplete="new-password"
            aria-invalid={Boolean(passwordError)}
          />
          {passwordError && (
            <p className="text-xs text-destructive">{passwordError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-confirm" className="text-sm font-medium">
            确认密码
          </label>
          <PasswordInput
            id="reg-confirm"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (confirmError) setConfirmError(null);
            }}
            disabled={submitting}
            placeholder="再次输入密码"
            autoComplete="new-password"
            aria-invalid={Boolean(confirmError)}
          />
          {confirmError && (
            <p className="text-xs text-destructive">{confirmError}</p>
          )}
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span>注册中...</span>
            </>
          ) : (
            <span>注册</span>
          )}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        已有账号？{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-foreground underline underline-offset-4 hover:opacity-80 cursor-pointer"
        >
          直接登录
        </button>
      </p>
    </div>
  );
}
