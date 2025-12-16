"use client";

import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { ModeToggle } from "./theme-toggler";
import { User } from "lucide-react";

export default function SidebarFooterComponent() {
  const { data: session } = authClient.useSession();

  if (session) {
    return (
      <div className="flex items-center justify-between gap-4 p-4 border-t">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt="Profile picture"
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-medium">
              {session.user.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </span>
          </div>
        </div>
        <ModeToggle />
      </div>
    );
  }
}
