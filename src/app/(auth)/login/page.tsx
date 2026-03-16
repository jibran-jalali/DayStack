import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Log In",
};

export default function LoginPage() {
  return <AuthShell mode="login" />;
}
