import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export type AuthModalMode = "login" | "register";

interface OpenAuthModalOptions {
  onSuccess?: () => void;
}

interface AuthModalContextValue {
  openAuthModal: (mode?: AuthModalMode, options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("login");
  const [prefilledUsername, setPrefilledUsername] = useState("");
  const [justRegistered, setJustRegistered] = useState(false);
  const [onSuccessCallback, setOnSuccessCallback] = useState<
    (() => void) | null
  >(null);

  const openAuthModal = useCallback(
    (targetMode: AuthModalMode = "login", options?: OpenAuthModalOptions) => {
      setMode(targetMode);
      setPrefilledUsername("");
      setJustRegistered(false);
      setOnSuccessCallback(() => options?.onSuccess ?? null);
      setOpen(true);
    },
    [],
  );

  const closeAuthModal = useCallback(() => {
    setOpen(false);
    setJustRegistered(false);
    setOnSuccessCallback(null);
  }, []);

  const value = useMemo(
    () => ({ openAuthModal, closeAuthModal }),
    [openAuthModal, closeAuthModal],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}

      {/* 居中浮层登录/注册弹窗：不顶掉当前浏览页面与正在播放的视频 */}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeAuthModal();
        }}
      >
        <DialogContent className="sm:max-w-sm p-6 sm:p-7">
          <DialogHeader className="items-center text-center mb-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold tracking-tighter">
                M
              </span>
              <span className="text-sm font-semibold tracking-[0.16em]">
                MONO
              </span>
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {mode === "login" ? "登录你的账号" : "创建 MONO 账号"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {mode === "login"
                ? "使用用户名和密码登录 MONO"
                : "注册新的 MONO 账号"}
            </DialogDescription>
          </DialogHeader>

          {mode === "login" ? (
            <LoginForm
              key={`login-${prefilledUsername}-${justRegistered}`}
              initialUsername={prefilledUsername}
              registeredBanner={justRegistered}
              onSuccess={() => {
                const cb = onSuccessCallback;
                closeAuthModal();
                cb?.();
              }}
              onSwitchToRegister={() => {
                setJustRegistered(false);
                setMode("register");
              }}
            />
          ) : (
            <RegisterForm
              onRegistered={(username) => {
                // 注册成功不自动登录：切换为登录态并展示成功提示条 + 预填原样用户名
                setPrefilledUsername(username);
                setJustRegistered(true);
                setMode("login");
              }}
              onSwitchToLogin={() => {
                setJustRegistered(false);
                setMode("login");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return ctx;
}
