import { BanknoteArrowUp, HandCoins, Home, Inbox } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Inbox,
    subtitle: [
      {
        title: "Pemasukan",
        url: "/dashboard/pemasukan",
        icon: HandCoins,
      },
      {
        title: "Pengeluaran",
        url: "/dashboard/pengeluaran",
        icon: BanknoteArrowUp,
      },
    ],
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {/* MAIN MENU */}
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>

                  {/* SUB MENU */}
                  {item.subtitle && (
                    <SidebarMenu className="mx-2 mt-1">
                      {item.subtitle.map((sub) => (
                        <SidebarMenuItem key={sub.title}>
                          <SidebarMenuButton asChild size="sm">
                            <a href={sub.url}>
                              <sub.icon />
                              <span>{sub.title}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
