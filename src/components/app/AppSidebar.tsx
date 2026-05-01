import { LayoutDashboard, Box, Package, History, Camera, Settings } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { t, type Language } from '@/lib/ace-translations';

const navItems = [
  { titleKey: 'nav.dashboard', url: '/', icon: LayoutDashboard },
  { titleKey: 'nav.ace', url: '/ace', icon: Box },
  { titleKey: 'nav.filament', url: '/filament', icon: Package },
  { titleKey: 'nav.history', url: '/history', icon: History },
  { titleKey: 'nav.camera', url: '/camera', icon: Camera },
];

interface Props {
  lang: Language;
  onOpenSettings: () => void;
}

export function AppSidebar({ lang, onOpenSettings }: Props) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <h2 className="text-lg font-bold tracking-tight text-foreground">PrintHub</h2>
        )}
        {collapsed && (
          <span className="text-lg font-bold text-primary">P</span>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed ? t(lang, 'nav.menu') : ''}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(lang, item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
              {!collapsed && <span>{t(lang, 'nav.settings')}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
