import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/lib/types";
import {
  getInitialMockUser,
  mockFetchCsrf,
  mockFetchMe,
  mockLogin,
  mockLogout,
  mockRegister,
  setDemoSession,
} from "./mock-auth-api";

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  csrfToken: string | null;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  loginAsDemo: () => void;
  toggleDemoAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // 从当前会话初始化，同时启动时通过 A04 同步状态
  const [user, setUser] = useState<User | null>(() => getInitialMockUser());
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const csrfRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void mockFetchMe()
      .then((session) => {
        if (!cancelled) {
          setUser(session?.user ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureCsrf = useCallback(async (): Promise<string> => {
    if (csrfRef.current) return csrfRef.current;
    const res = await mockFetchCsrf();
    csrfRef.current = res.csrf_token;
    setCsrfToken(res.csrf_token);
    return res.csrf_token;
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<User> => {
      const token = await ensureCsrf();
      const res = await mockLogin(username, password, token);
      // 登录成功后立即更新内存中的 CSRF Token
      csrfRef.current = res.csrf_token;
      setCsrfToken(res.csrf_token);
      setUser(res.user);
      return res.user;
    },
    [ensureCsrf],
  );

  const register = useCallback(
    async (username: string, password: string): Promise<User> => {
      const token = await ensureCsrf();
      return mockRegister(username, password, token);
    },
    [ensureCsrf],
  );

  const logout = useCallback(async (): Promise<void> => {
    await mockLogout(csrfRef.current);
    csrfRef.current = null;
    setCsrfToken(null);
    setUser(null);
    // 严格遵守契约：退出登录绝不清除 localStorage 中未完成上传的断点元数据
  }, []);

  const loginAsDemo = useCallback(() => {
    const demo = setDemoSession(true);
    setUser(demo);
  }, []);

  const toggleDemoAuth = useCallback(() => {
    setUser((prev) => setDemoSession(prev === null));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      csrfToken,
      login,
      register,
      logout,
      loginAsDemo,
      toggleDemoAuth,
    }),
    [user, csrfToken, login, register, logout, loginAsDemo, toggleDemoAuth],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
