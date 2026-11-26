import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Film,
  LogOut,
  Moon,
  Plus,
  Sun,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, useTheme } from "@/app/providers";
import { useAuthModal } from "@/features/auth/AuthModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAvatarInitial } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Layout() {
  const { user, isAuthenticated, logout, toggleDemoAuth } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    toast.success("已退出登录");
    if (
      location.pathname.startsWith("/upload") ||
      location.pathname.startsWith("/me/submissions")
    ) {
      navigate("/", { replace: true });
    }
  };

  const handleToggleDemoAuth = () => {
    const nextLoggedIn = !isAuthenticated;
    toggleDemoAuth();
    toast.info(
      nextLoggedIn
        ? "已切换至「已登录演示态」（Alice）"
        : "已切换至「游客演示态」",
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* 吸顶纯顶栏 h-14 毛玻璃 */}
      <header className="sticky top-0 z-40 h-14 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between gap-4">
          {/* 左侧：MONO Logo + 主导航 */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
            >
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold tracking-tighter">
                M
              </span>
              <span className="text-base tracking-[0.14em] font-semibold">
                MONO
              </span>
            </Link>

            <nav className="flex items-center gap-1" aria-label="主导航">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                  )
                }
              >
                首页
              </NavLink>
              {isAuthenticated && (
                <NavLink
                  to="/me/submissions"
                  className={({ isActive }) =>
                    cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                    )
                  }
                >
                  我的投稿
                </NavLink>
              )}
            </nav>
          </div>

          {/* 右侧：演示态切换 + 投稿/登录注册 + 亮暗切换 + 头像菜单 */}
          <div className="flex items-center gap-2">
            {/* 轻量演示态切换入口（仅用于本地 Mock 预览游客/已登录态） */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleDemoAuth}
              className="hidden sm:inline-flex h-8 gap-1.5 rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground hover:text-foreground"
              title="切换本地预览的登录/游客状态"
            >
              {isAuthenticated ? (
                <>
                  <UserCheck className="size-3.5" />
                  <span>演示：已登录</span>
                </>
              ) : (
                <>
                  <UserX className="size-3.5" />
                  <span>演示：游客</span>
                </>
              )}
            </Button>

            {isAuthenticated && user ? (
              <>
                <Button asChild size="sm" className="h-8 gap-1.5 px-3">
                  <Link to="/upload">
                    <Plus className="size-4" />
                    <span>投稿</span>
                  </Link>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"
                  }
                >
                  {theme === "dark" ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 gap-2 rounded-full pl-1 pr-2.5 hover:bg-secondary"
                      aria-label="用户菜单"
                    >
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-secondary border border-border text-xs font-medium text-foreground">
                        {getAvatarInitial(user.username)}
                      </span>
                      <span className="hidden md:inline max-w-[100px] truncate text-sm font-medium">
                        {user.username}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-0.5">
                        <p className="text-sm font-medium leading-none truncate">
                          {user.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          已登录账号
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        to="/me/submissions"
                        className="cursor-pointer flex items-center gap-2"
                      >
                        <Film className="size-4" />
                        <span>我的投稿</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleToggleDemoAuth}
                      className="sm:hidden cursor-pointer flex items-center gap-2"
                    >
                      <UserX className="size-4" />
                      <span>切换为游客态</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void handleLogout()}
                      className="cursor-pointer flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="size-4" />
                      <span>退出登录</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"
                  }
                >
                  {theme === "dark" ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8"
                  onClick={() => openAuthModal("login")}
                >
                  登录
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={() => openAuthModal("register")}
                >
                  注册
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
