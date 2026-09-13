"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UserMenu({
  email,
  fullName,
  role,
}: {
  email: string;
  fullName: string | null;
  role: string;
}) {
  const display = fullName || email;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials(display)}</AvatarFallback>
        </Avatar>
        <div className="hidden text-left sm:block">
          <div className="text-sm font-medium">{display}</div>
          <div className="text-[11px] capitalize text-muted-foreground">{role}</div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span>{display}</span>
            <span className="text-xs font-normal text-muted-foreground">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem
            nativeButton
            render={<button type="submit" className="w-full cursor-pointer" />}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
