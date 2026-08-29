import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import usePermissionsStore, { usePermissions } from '@/stores/permissions-store';
import { FeatureAccessLevel } from '@/types/settings';
import { Loader2 } from 'lucide-react';
import {
  Settings,
  Palette,
  Shapes,
  UserCheck,
  Activity,
  UserCog,
  ScrollText,
  Blocks,
  type LucideIcon,
} from 'lucide-react';

interface SettingsNavItem {
  path: string;
  labelKey: string;
  defaultLabel: string;
  icon: LucideIcon;
  permissionId: string;
}

interface SettingsNavGroup {
  titleKey: string;
  defaultTitle: string;
  items: SettingsNavItem[];
}

// ─── DPZ Builder Hub: only the settings that matter ───
const settingsNavGroups: SettingsNavGroup[] = [
  {
    titleKey: 'settings:nav.groups.catalog',
    defaultTitle: 'Catalog',
    items: [
      { path: '/settings/asset-types', labelKey: 'settings:tabs.assetTypes', defaultLabel: 'Asset Types', icon: Shapes, permissionId: 'settings-asset-types' },
      { path: '/settings/capabilities', labelKey: 'settings:tabs.capabilities', defaultLabel: 'Capabilities', icon: Blocks, permissionId: 'settings-asset-types' },
      { path: '/settings/maturity-levels', labelKey: 'settings:tabs.maturityLevels', defaultLabel: 'Maturity Levels', icon: Activity, permissionId: 'settings-maturity-levels' },
    ],
  },
  {
    titleKey: 'settings:nav.groups.organization',
    defaultTitle: 'Organization',
    items: [
      { path: '/settings/teams', labelKey: 'settings:tabs.teams', defaultLabel: 'Teams', icon: UserCheck, permissionId: 'teams' },
      { path: '/settings/roles', labelKey: 'settings:tabs.roles', defaultLabel: 'App Roles', icon: UserCog, permissionId: 'settings-roles' },
    ],
  },
  {
    titleKey: 'settings:nav.groups.platform',
    defaultTitle: 'Platform',
    items: [
      { path: '/settings/general', labelKey: 'settings:tabs.general', defaultLabel: 'General', icon: Settings, permissionId: 'settings-general' },
      { path: '/settings/ui', labelKey: 'settings:tabs.ui', defaultLabel: 'Appearance', icon: Palette, permissionId: 'settings-ui' },
      { path: '/settings/audit', labelKey: 'settings:tabs.audit', defaultLabel: 'Audit Trail', icon: ScrollText, permissionId: 'audit' },
    ],
  },
];

export default function SettingsLayout() {
  const { t } = useTranslation(['settings']);
  const { isLoading: permissionsLoading, hasPermission } = usePermissions();
  const initAttempted = usePermissionsStore((s) => s._initAttempted);
  const isInitializing = usePermissionsStore((s) => s._isInitializing);

  if (permissionsLoading || isInitializing || !initAttempted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission('settings', FeatureAccessLevel.READ_ONLY)) {
    return <Navigate to="/" replace />;
  }

  const visibleGroups = settingsNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        hasPermission(item.permissionId, FeatureAccessLevel.READ_ONLY)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex gap-8 min-h-[calc(100vh-12rem)]">
      <nav className="w-52 shrink-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-2">
          <span className="w-4 h-px bg-primary inline-block" />Admin
        </p>
        <h1 className="text-2xl font-semibold mb-6">
          {t('settings:title', 'Settings')}
        </h1>

        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.defaultTitle}>
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 px-3">
                {t(group.titleKey, group.defaultTitle)}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {t(item.labelKey, item.defaultLabel)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
