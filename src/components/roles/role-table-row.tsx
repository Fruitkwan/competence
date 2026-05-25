"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

export function RoleTableRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-muted/50"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </TableRow>
  );
}
