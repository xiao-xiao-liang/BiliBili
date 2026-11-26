import { DEMO_CURRENT_USER } from "@/lib/mock-data";
import type { User } from "@/lib/types";

export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,32}$/;
export const PASSWORD_MIN_BYTES = 8;
export const PASSWORD_MAX_BYTES = 128;

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export class MockAuthError extends Error {
  code: string;
  status: number;
  retryAfter?: number;

  constructor(
    code: string,
    message: string,
    status: number,
    retryAfter?: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

interface StoredAccount {
  user: User;
  password: string;
}

const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

// 严格区分大小写的账号表（Alice 与 alice 为不同 key）
const accounts = new Map<string, StoredAccount>([
  [
    DEMO_CURRENT_USER.username,
    {
      user: DEMO_CURRENT_USER,
      password: "password123",
    },
  ],
  [
    "Bob",
    {
      user: {
        id: "u-00000000-0000-4000-8000-000000000002",
        username: "Bob",
        created_at: "2026-10-05T11:20:00Z",
      },
      password: "password123",
    },
  ],
]);

const SESSION_STORAGE_KEY = "mono_mock_auth_session_v1";

function loadInitialSession(): { user: User; expires_at: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === "null") return null;
    if (raw) {
      return JSON.parse(raw) as { user: User; expires_at: string };
    }
  } catch {
    // ignore
  }
  // 首次打开标签页默认以演示账号 Alice 启动，方便直接预览
  return {
    user: DEMO_CURRENT_USER,
    expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
  };
}

function saveSession(session: { user: User; expires_at: string } | null): void {
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      session ? JSON.stringify(session) : "null",
    );
  } catch {
    // ignore
  }
}

// 内存 + sessionStorage 同步当前会话（绝不污染 localStorage 断点数据）
let activeSession: { user: User; expires_at: string } | null =
  loadInitialSession();

function makeCsrfToken(): string {
  return `csrf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// A01: GET /api/v1/auth/csrf
export async function mockFetchCsrf(): Promise<{ csrf_token: string }> {
  await delay(60);
  return { csrf_token: makeCsrfToken() };
}

// A04: GET /api/v1/auth/me（静默恢复，不续期）
export async function mockFetchMe(): Promise<{
  user: User;
  expires_at: string;
} | null> {
  await delay(80);
  return activeSession ? structuredClone(activeSession) : null;
}

// A02: POST /api/v1/auth/register（区分大小写唯一，不自动登录）
export async function mockRegister(
  username: string,
  password: string,
  _csrfToken: string,
): Promise<User> {
  await delay(260);

  if (!USERNAME_REGEX.test(username)) {
    throw new MockAuthError(
      "INVALID_ARGUMENT",
      "用户名需为 3～32 位 ASCII 字母、数字或下划线",
      400,
    );
  }

  const byteLen = getUtf8ByteLength(password);
  if (byteLen < PASSWORD_MIN_BYTES || byteLen > PASSWORD_MAX_BYTES) {
    throw new MockAuthError(
      "INVALID_ARGUMENT",
      "密码长度需在 8～128 字节之间",
      400,
    );
  }

  // 严格大小写唯一性检查
  if (accounts.has(username)) {
    throw new MockAuthError(
      "USERNAME_TAKEN",
      `用户名「${username}」已被占用`,
      409,
    );
  }

  const newUser: User = {
    id: `u-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    username,
    created_at: new Date().toISOString(),
  };
  accounts.set(username, { user: newUser, password });

  // 契约约定：注册不自动登录
  return structuredClone(newUser);
}

// A03: POST /api/v1/auth/login（大小写精确匹配，错误统一 401）
export async function mockLogin(
  username: string,
  password: string,
  _csrfToken: string,
): Promise<{ user: User; expires_at: string; csrf_token: string }> {
  await delay(260);

  const account = accounts.get(username);
  if (!account || account.password !== password) {
    throw new MockAuthError(
      "INVALID_CREDENTIALS",
      "用户名或密码错误",
      401,
    );
  }

  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  activeSession = {
    user: structuredClone(account.user),
    expires_at: expiresAt,
  };
  saveSession(activeSession);

  return {
    user: structuredClone(account.user),
    expires_at: expiresAt,
    csrf_token: makeCsrfToken(),
  };
}

// A05: POST /api/v1/auth/logout（清除当前会话，保留 localStorage 断点）
export async function mockLogout(_csrfToken: string | null): Promise<void> {
  await delay(120);
  activeSession = null;
  saveSession(null);
}

// 演示快捷切换：不经过表单直接设置演示用户
export function setDemoSession(loggedIn: boolean): User | null {
  if (loggedIn) {
    activeSession = {
      user: DEMO_CURRENT_USER,
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    };
    saveSession(activeSession);
    return DEMO_CURRENT_USER;
  }
  activeSession = null;
  saveSession(null);
  return null;
}

export function getInitialMockUser(): User | null {
  return activeSession ? structuredClone(activeSession.user) : null;
}
