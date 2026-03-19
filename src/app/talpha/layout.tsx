import LoginGate from "@/components/auth/login-gate";

export default function TAlphaLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LoginGate>{children}</LoginGate>
    );
}
