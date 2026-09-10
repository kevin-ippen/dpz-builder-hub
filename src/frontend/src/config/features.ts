import {
    Box,
    FlaskConical,
    Lightbulb,
    Briefcase,
    BarChart3,
    Settings,
    Target,
    GraduationCap,
    Upload,
    type LucideIcon,
  } from 'lucide-react';
  
  export type FeatureMaturity = 'ga' | 'beta' | 'alpha';
  export type FeatureGroup = 'Discover' | 'Create' | 'Observe';
  
  /** Module IDs that map to backend MODULE_* env vars. */
  export type ModuleId = 'explore' | 'lab' | 'learn' | 'portfolio' | 'wishlist' | 'dashboard' | 'mcp' | 'compliance' | 'pipeline' | 'contracts' | 'semantic';

  export interface FeatureConfig {
    id: string;
    name: string;
    path: string;
    description: string;
    icon: LucideIcon;
    group: FeatureGroup;
    maturity: FeatureMaturity;
    showInLanding?: boolean;
    /** When set, permission checks use this feature ID instead of `id`. */
    permissionId?: string;
    /** Maps this feature to a backend MODULE_* toggle. When that module is disabled, the feature is hidden. */
    moduleId?: ModuleId;
  }
  
  export const features: FeatureConfig[] = [
    // ─── Discover ─── Find, learn, and explore the landscape
    {
      id: 'assets',
      name: 'Explore',
      path: '/assets',
      description: 'Browse certified and production-ready assets — filter by type, maturity, and domain.',
      icon: Box,
      group: 'Discover',
      maturity: 'ga',
      showInLanding: true,
      moduleId: 'explore',
    },
    {
      id: 'lab',
      name: 'Lab',
      path: '/lab',
      description: 'Experimental builds, submit new ideas, and community contributions — pre-production work.',
      icon: FlaskConical,
      group: 'Discover',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'assets',
      moduleId: 'lab',
    },
    {
      id: 'learn',
      name: 'Learn',
      path: '/learn',
      description: 'Blogs, release notes, repos, and how-to guides — everything in one place.',
      icon: GraduationCap,
      group: 'Discover',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'assets',
      moduleId: 'learn',
    },

    // ─── My Stuff ─── Your portfolio and wishlist
    {
      id: 'my-products',
      name: 'My Portfolio',
      path: '/my-portfolio',
      description: 'Your assets across all maturity stages — ideas through production.',
      icon: Briefcase,
      group: 'Create',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'data-products',
      moduleId: 'portfolio',
    },
    {
      id: 'my-requests',
      name: 'Wishlist',
      path: '/wishlist',
      description: 'What the team needs next — upvote to signal demand, seeded by leadership priorities.',
      icon: Target,
      group: 'Create',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'data-products',
      moduleId: 'wishlist',
    },

    // ─── Observe ─── Portfolio health, metrics, admin
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: '/dashboard',
      description: 'Portfolio health, adoption signals, staleness alerts, and capability coverage.',
      icon: BarChart3,
      group: 'Observe',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'assets',
      moduleId: 'dashboard',
    },
    {
      id: 'settings',
      name: 'Settings',
      path: '/settings',
      description: 'Platform configuration, roles, connectors, and governance settings.',
      icon: Settings,
      group: 'Observe',
      maturity: 'ga',
      showInLanding: false,
    },

    {
      id: 'data-products',
      name: 'Submit',
      path: '/submit',
      description: 'Register a new asset — paste a repo URL or workspace path to auto-fill.',
      icon: Upload,
      group: 'Create',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'data-products',  // reuses data-products permission
    },
  ];
  
  // Helper function to get feature by path
  export const getFeatureByPath = (path: string): FeatureConfig | undefined =>
    features.find((feature) => feature.path === path);
  
  // Helper function to get feature name by path (for breadcrumbs)
  export const getFeatureNameByPath = (pathSegment: string): string => {
      const feature = features.find(f => f.path === `/${pathSegment}` || f.path === pathSegment);
      return feature?.name || pathSegment;
  };
  
  // Helper function to group features for navigation
  export const getNavigationGroups = (
      allowedMaturities: FeatureMaturity[] = ['ga'],
      enabledModules?: Record<string, boolean>,
    ): { name: FeatureGroup; items: FeatureConfig[] }[] => {
      const grouped: { [key in FeatureGroup]?: FeatureConfig[] } = {};
  
      features
        .filter((feature) => allowedMaturities.includes(feature.maturity))
        .filter((feature) => {
          // If no module map yet (still loading), show everything
          if (!enabledModules) return true;
          // Features without a moduleId are always shown (e.g. Settings)
          if (!feature.moduleId) return true;
          return enabledModules[feature.moduleId] !== false;
        })
        .forEach((feature) => {
          if (!grouped[feature.group]) {
            grouped[feature.group] = [];
          }
          grouped[feature.group]?.push(feature);
        });
  
      const groupOrder: FeatureGroup[] = ['Discover', 'Create', 'Observe'];
  
      return groupOrder
          .map(groupName => ({
              name: groupName,
              items: grouped[groupName] || []
          }))
          .filter(group => group.items.length > 0);
    };
  
  // Helper function to get features for landing pages (Home, About)
  export const getLandingPageFeatures = (
      allowedMaturities: FeatureMaturity[] = ['ga'],
      enabledModules?: Record<string, boolean>,
  ): FeatureConfig[] => {
      return features.filter(
          (feature) =>
          feature.showInLanding
          && allowedMaturities.includes(feature.maturity)
          && (!enabledModules || !feature.moduleId || enabledModules[feature.moduleId] !== false)
      );
  };
