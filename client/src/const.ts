export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Self-hosted auth - login page is local
export const getLoginUrl = (returnPath?: string) => {
  const path = returnPath || window.location.pathname;
  if (path === "/login" || path === "/register") return "/login";
  return `/login?redirect=${encodeURIComponent(path)}`;
};
