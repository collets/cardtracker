import { AppNav } from "@/components/app-nav";
import { ActionToasts } from "@/components/action-feedback";
import { requireUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="lg:flex">
      <AppNav role={user.role} userId={user.id} />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        {children}
      </main>
      <ActionToasts />
    </div>
  );
}
