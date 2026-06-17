import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Sliding window limiters per endpoint type
const limiters = {
  // Sign-in: 5 attempts per 15 minutes, keyed by IP + email
  signIn: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15m"),
    prefix: "rl:signin",
  }),
  // Registration: 3 attempts per hour, keyed by IP
  register: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1h"),
    prefix: "rl:register",
  }),
  // Forgot password: 3 attempts per hour, keyed by IP
  forgotPassword: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1h"),
    prefix: "rl:forgot-password",
  }),
  // Password reset: 5 attempts per 15 minutes, keyed by IP
  resetPassword: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15m"),
    prefix: "rl:reset-password",
  }),
  // Resend verification: 3 attempts per 15 minutes, keyed by IP + email
  resendVerification: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "15m"),
    prefix: "rl:resend-verification",
  }),
};

export type RateLimitResult =
  | { success: true }
  | { success: false; retryAfterSeconds: number };

async function check(
  limiter: Ratelimit,
  key: string,
): Promise<RateLimitResult> {
  try {
    const result = await limiter.limit(key);
    if (result.success) return { success: true };
    const retryAfterSeconds = Math.ceil((result.reset - Date.now()) / 1000);
    return { success: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  } catch {
    // Fail open — if Upstash is unavailable, allow the request
    return { success: true };
  }
}

async function getIP(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

export async function checkSignInLimit(email: string): Promise<RateLimitResult> {
  const ip = await getIP();
  return check(limiters.signIn, `${ip}:${email}`);
}

export async function checkRegisterLimit(): Promise<RateLimitResult> {
  const ip = await getIP();
  return check(limiters.register, ip);
}

export async function checkForgotPasswordLimit(): Promise<RateLimitResult> {
  const ip = await getIP();
  return check(limiters.forgotPassword, ip);
}

export async function checkResetPasswordLimit(): Promise<RateLimitResult> {
  const ip = await getIP();
  return check(limiters.resetPassword, ip);
}

export async function checkResendVerificationLimit(email: string): Promise<RateLimitResult> {
  const ip = await getIP();
  return check(limiters.resendVerification, `${ip}:${email}`);
}
