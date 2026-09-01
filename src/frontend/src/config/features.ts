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
      allowedMaturities: FeatureMaturity[] = ['ga']
    ): { name: FeatureGroup; items: FeatureConfig[] }[] => {
      const grouped: { [key in FeatureGroup]?: FeatureConfig[] } = {};
  
      features
        .filter((feature) => allowedMaturities.includes(feature.maturity))
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
      allowedMaturities: FeatureMaturity[] = ['ga']
  ): FeatureConfig[] => {
      return features.filter(
          (feature) =>
          feature.showInLanding && allowedMaturities.includes(feature.maturity)
      );
  };
